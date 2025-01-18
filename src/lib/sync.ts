import type { IDBPDatabase } from 'idb';
import { type ControlEntry, type MarkerEntryProps, type State } from './state.svelte';
import { lastChanged, mv2DBStr } from './utils';

interface IdAndChanged {
	id: string;
	lastChanged: string;
}

// who has newer data, server or client?
// both occurs, if some new controls on both.
type ServerOrClient = 'client' | 'server' | 'none' | 'both';

export interface ServerChanges {
	id: number;
	lastChanged: string;
	ctrlChanges: {
		id: number;
		lastChanged: string;
	}[];
}

export class Sync {
	private nkState: State;
	private fetch: Function;
	private setProgress: Function;
	private mvalsP: MarkerEntryProps[] = [];
	private idb: IDBPDatabase | null = null;

	constructor(nkState: State, fetch: Function, setProgress: Function) {
		this.nkState = nkState;
		this.fetch = fetch;
		this.setProgress = setProgress;
		this.idb = nkState.idb;
	}

	async sync() {
		const scMap = new Map<string, ServerChanges>(); // lastChanged date of db entries
		const csMap = new Map<string, ServerOrClient>(); // server: newer or new on server
		const resp1 = await this.fetch('/api/db?what=chg', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});
		const serverChanges = (await resp1.json()) as ServerChanges[];
		for (let sc of serverChanges) {
			const idS = sc.id.toString();
			scMap.set(idS, sc);
			csMap.set(idS, 'server');
		}
		this.mvalsP = await this.nkState.fetchMarkersProps(); // including deleted items
		await this.nkState.fetchCtrlsProps(this.mvalsP);

		for (let mvP of this.mvalsP) {
			const cmp = this.compareChanges(mvP, scMap.get(mvP.id));
			csMap.set(mvP.id, cmp); // may overwrite entries set to server above
		}
		csMap.forEach((v, k) => {
			if (v == 'none') csMap.delete(k);
			if (v == 'server') csMap.delete(k);
		});
		let len = csMap.size;
		let index = 0;
		for (const [mvid, sorc] of csMap.entries()) {
			if (sorc == 'client' || sorc == 'both') {
				await this.storeOnServer(mvid);
			}
			// if (sorc == 'server') {
			// 	await this.loadFromServer(mvid);
			// }

			index++;
			const progress = (index / len) * 50;
			this.setProgress(progress);
		}

		// clear local data
		if (this.idb) {
			await this.idb.clear('kontrollen');
			await this.idb.clear('nk');
		} else {
			localStorage.clear();
		}
		// transfer DB to local data
		const resp2 = await this.fetch('/api/db?what=nk', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});
		const mvals = (await resp2.json()) as MarkerEntryProps[];

		const resp3 = await this.fetch('/api/db?what=kn', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});
		const ctrls = (await resp3.json()) as ControlEntry[];

		len = mvals.length + ctrls.length;
		index = 0;
		for (const mvP of mvals) {
			const js = mv2DBStr(mvP, false);
			if (this.idb) {
				try {
					await this.idb.put('nk', js, mvP.id.toString());
				} catch (e: any) {
					console.log('err idb.put', e);
				}
			} else {
				localStorage.setItem(mvP.id, js);
			}
			index++;
			const progress = (index / len) * 50 + 50;
			this.setProgress(progress);
		}
		for (const ctrl of ctrls) {
			ctrl.id = ctrl.id.toString();
			ctrl.nkid = ctrl.nkid.toString();
			this.nkState.storeCtrl(ctrl);
			index++;
			const progress = (index / len) * 50 + 50;
			this.setProgress(progress);
		}
		this.nkState.fetchData();
		this.setProgress(0);
	}

	async storeOnServer(mvid: string) {
		const mvP = this.mvalsP.find((m) => m.id == mvid)!;
		const js = mv2DBStr(mvP, true);
		const response = await fetch!('/api/db', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: js
		});
		// const idChanges = await response.json();
		// await this.changeIds(mvP, idChanges);
	}

	// async loadFromServer(mvid: string) {
	// 	const resp = await this.fetch('/api/db/' + mvid, {
	// 		method: 'GET',
	// 		headers: {
	// 			'Content-Type': 'application/json'
	// 		}
	// 	});
	// 	const mvP = (await resp.json()) as MarkerEntryProps;
	// 	const js = mv2DBStr(mvP, false);
	// 	if (this.idb) {
	// 		try {
	// 			await this.idb.put('nk', js, mvP.id.toString());
	// 		} catch (e: any) {
	// 			console.log('err idb.put', e);
	// 		}
	// 	} else {
	// 		localStorage.setItem(mvP.id, js);
	// 	}
	// 	for (const ctrl of mvP.ctrls || []) {
	// 		ctrl.id = ctrl.id.toString();
	// 		ctrl.nkid = ctrl.nkid.toString();
	// 		this.nkState.storeCtrl(ctrl);
	// 	}
	// }

	compareChanges(
		mvP: MarkerEntryProps,
		sc: ServerChanges | undefined
	): 'client' | 'server' | 'none' | 'both' {
		if (!sc) return 'client';

		let lc = lastChanged(mvP);
		const mics = this.convertControlEntriesToICArray(mvP.ctrls || []);
		const sics = this.convertServerChangesControlEntries(sc.ctrlChanges);
		if (lc < sc.lastChanged) return this.compareCtrlChanges(mics, sics, 'server');
		if (lc > sc.lastChanged) return this.compareCtrlChanges(mics, sics, 'client');
		return this.compareCtrlChanges(mics, sics, 'none');
	}

	convertControlEntriesToICArray(ctrls: ControlEntry[]): IdAndChanged[] {
		let res: IdAndChanged[] = [];
		for (const ctrl of ctrls || []) {
			let lc = lastChanged(ctrl);
			res.push({ id: ctrl.id, lastChanged: lc });
		}
		return res;
	}

	convertServerChangesControlEntries(
		ctrls: {
			id: number;
			lastChanged: string;
		}[]
	): IdAndChanged[] {
		let res: IdAndChanged[] = [];
		for (const ctrl of ctrls || []) {
			res.push({ id: ctrl.id.toString(), lastChanged: ctrl.lastChanged });
		}
		return res;
	}

	compareCtrlChanges(m: IdAndChanged[], s: IdAndChanged[], msorc: ServerOrClient): ServerOrClient {
		let server = false;
		let client = false;

		for (const me of m) {
			let foundMinS = false;
			for (const se of s) {
				if (me.id == se.id) {
					foundMinS = true;
					if (me.lastChanged < se.lastChanged) {
						server = true;
					}
					if (me.lastChanged > se.lastChanged) {
						client = true;
					}
					break;
				}
			}
			if (!foundMinS) client = true; // client has a control that server does not or is newer
		}
		for (const se of s) {
			let foundSinM = false;
			for (const me of m) {
				if (se.id == me.id) {
					foundSinM = true;
					if (se.lastChanged < me.lastChanged) {
						client = true;
					}
					if (se.lastChanged > me.lastChanged) {
						server = true;
					}
					break;
				}
			}
			if (!foundSinM) server = true; // server has a control that client does not or is newer
		}
		if (server && client) return 'both';
		if (server && msorc == 'client') return 'both';
		if (client && msorc == 'server') return 'both';
		if (server) return 'server';
		if (client) return 'client';
		return msorc;
	}

	/* 
	// instead of a fine grained update of local data from newer data in the db,
	// we now just clear the local data and read the whole db 
	findNewId(ctrls: any, id: string): string | null {
		for (const ctrl of ctrls) {
			if (ctrl.oldid == id) return ctrl.newid?.toString();
		}
		return null;
	}

	// The server responded to the POST /api/db with a mapping from old (local, client) ids
	// to autogenerated server ids (see /routes/api/db/+server.ts). We must replace the
	// local entries with entries containing the new ids.
	async changeIds(mvP: MarkerEntryProps, idChanges: any) {
		if (idChanges.delete) {
			if (this.idb) {
				await this.idb.delete('nk', mvP.id);
				for (const ctrl of mvP.ctrls || []) {
					await this.idb.delete('kontrollen', ctrl.id);
				}
			} else {
				localStorage.removeItem(mvP.id);
				for (const ctrl of mvP.ctrls || []) {
					localStorage.removeItem('_k_' + ctrl.id);
				}
			}
			return;
		}
		if (this.idb) {
			await this.changeIdsIdb(mvP, idChanges);
		} else {
			this.changeIdsLs(mvP, idChanges);
		}
	}

	async changeIdsIdb(mvP: MarkerEntryProps, idChanges: any) {
		const idb = this.idb!;
		if (idChanges.updateids) {
			console.assert(
				mvP.id == idChanges.updateids.oldid,
				`marker oldid ${mvP.id} != idchanges.oldid ${idChanges.updateids.oldid}`
			);
			const txnk = idb.transaction('nk', 'readwrite');
			const store = txnk.objectStore('nk');
			await store.delete(mvP.id);
			mvP.id = idChanges.updateids.newid.toString();
			const js = mv2DBStr(mvP, false);
			await store.put(js, mvP.id);
			await txnk.done;
		}
		const ctrlChanges = idChanges.updatectrlids?.ctrls || idChanges.updateids?.ctrls;
		for (const ctrl of mvP.ctrls || []) {
			const newid = this.findNewId(ctrlChanges, ctrl.id);
			if (!newid) continue;
			const ctrlnk = idb.transaction('kontrollen', 'readwrite');
			const store = ctrlnk.objectStore('kontrollen');
			await store.delete(ctrl.id);
			ctrl.id = newid;
			ctrl.nkid = mvP.id;
			const js = ctrl2Str(ctrl, true);
			await store.put(js, newid);
			await ctrlnk.done;
		}
	}

	changeIdsLs(mvP: MarkerEntryProps, idChanges: any) {
		if (idChanges.updateids) {
			console.assert(
				mvP.id == idChanges.updateids.oldid.toString(),
				`marker oldid ${mvP.id} != idchanges.oldid ${idChanges.updateids.oldid}`
			);
			localStorage.removeItem(mvP.id);
			mvP.id = idChanges.updateids.newid.toString();
			const js = mv2DBStr(mvP, false);
			localStorage.setItem(mvP.id, js);
		}
		const ctrlChanges = idChanges.updatectrlids?.ctrls || idChanges.updateids?.ctrls;
		for (const ctrl of mvP.ctrls || []) {
			const newid = this.findNewId(ctrlChanges, ctrl.id);
			if (!newid) continue;
			localStorage.removeItem('_k_' + ctrl.id);
			ctrl.id = newid;
			ctrl.nkid = mvP.id;
			const js = ctrl2Str(ctrl, true);
			localStorage.setItem(newid, js);
		}
	}
	*/
}
