import type { IDBPDatabase } from 'idb';
import {
	ctrl2Str,
	mv2DBStr,
	type ControlEntry,
	type MarkerEntryProps,
	type State
} from './state.svelte';

interface IdAndChanged {
	id: string;
	changedAt: string;
}

// who has newer data, server or client?
// both occurs, if some new controls on both.
type ServerOrClient = 'client' | 'server' | 'none' | 'both';

export interface ServerChanges {
	id: number;
	changedAt: string;
	ctrlChanges: {
		id: number;
		changedAt: string;
	}[];
}
export const defaultDate = '2000-01-01T12:00:00Z';

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
		const scMap = new Map<string, ServerChanges>(); // changedAt date of db entries
		const csMap = new Map<string, ServerOrClient>(); // server: newer or new on server
		const resp = await this.fetch('/api/db', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});
		const serverChanges = (await resp.json()) as ServerChanges[];
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
		});
		let len = csMap.size;
		let index = 0;
		for (const [mvid, sorc] of csMap.entries()) {
			if (sorc == 'client') {
				await this.storeOnServer(mvid);
			}
			if (sorc == 'server') {
				await this.loadFromServer(mvid);
			}

			index++;
			const progress = (index / len) * 100;
			this.setProgress(progress);
		}
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
		const idChanges = await response.json();
		await this.changeIds(mvP, idChanges);
	}

	async loadFromServer(mvid: string) {
		const resp = await this.fetch('/api/db/' + mvid, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});
		const mvP = (await resp.json()) as MarkerEntryProps;
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
		for (const ctrl of mvP.ctrls || []) {
			ctrl.id = ctrl.id.toString();
			ctrl.nkid = ctrl.nkid.toString();
			this.nkState.storeCtrl(ctrl);
		}
	}

	compareChanges(
		mvP: MarkerEntryProps,
		sc: ServerChanges | undefined
	): 'client' | 'server' | 'none' | 'both' {
		if (!sc) return 'client';

		let mchangedAt = mvP.changedAt;
		if (!mchangedAt) mchangedAt = mvP.createdAt;
		if (!mchangedAt) mchangedAt = defaultDate;
		const mchangedAtS = mchangedAt ? (mchangedAt as string) : defaultDate;
		const mics = this.convertControlEntriesToICArray(mvP.ctrls || []);
		const sics = this.convertServerChangesControlEntries(sc.ctrlChanges);
		if (mchangedAtS < sc.changedAt) return this.compareCtrlChanges(mics, sics, 'server');
		if (mchangedAtS > sc.changedAt) return this.compareCtrlChanges(mics, sics, 'client');
		return this.compareCtrlChanges(mics, sics, 'none');
	}

	convertControlEntriesToICArray(ctrls: ControlEntry[]): IdAndChanged[] {
		let res: IdAndChanged[] = [];
		for (const ctrl of ctrls || []) {
			let changedAt = ctrl.changedAt;
			if (!changedAt) changedAt = ctrl.createdAt;
			const changedAtS = changedAt ? (changedAt as string) : defaultDate;
			res.push({ id: ctrl.id, changedAt: changedAtS });
		}
		return res;
	}

	convertServerChangesControlEntries(
		ctrls: {
			id: number;
			changedAt: string;
		}[]
	): IdAndChanged[] {
		let res: IdAndChanged[] = [];
		for (const ctrl of ctrls || []) {
			res.push({ id: ctrl.id.toString(), changedAt: ctrl.changedAt });
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
					if (me.changedAt < se.changedAt) {
						server = true;
					}
					if (me.changedAt > se.changedAt) {
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
					if (se.changedAt < me.changedAt) {
						client = true;
					}
					if (se.changedAt > me.changedAt) {
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

	findNewId(idChanges: any, id: string): string | null {
		const ctrls = idChanges.ctrls;
		for (const ctrl of ctrls) {
			if (ctrl.oldid == id) return ctrl.newid.toString();
		}
		return null;
	}

	async changeIds(mvP: MarkerEntryProps, idChanges: any) {
		if (this.idb) {
			await this.changeIdsIdb(mvP, idChanges);
		} else {
			this.changeIdsLs(mvP, idChanges);
		}
	}

	async changeIdsIdb(mvP: MarkerEntryProps, idChanges: any) {
		const idb = this.idb!;
		const txnk = idb.transaction('nk', 'readwrite');
		const store = txnk.objectStore('nk');
		console.assert(
			mvP.id == idChanges.oldid.toString(),
			`marker oldid ${mvP.id} != idchanges.oldid ${idChanges.oldid}`
		);
		await store.delete(mvP.id);
		mvP.id = idChanges.newid.toString();
		const js = mv2DBStr(mvP, false);
		await store.put(js, mvP.id);
		await txnk.done;
		for (const ctrl of mvP.ctrls || []) {
			const newid = this.findNewId(idChanges, ctrl.id);
			console.assert(newid, `id ${ctrl.id} not found in ${idChanges}`);
			if (!newid) continue;
			const ctrlnk = idb.transaction('kontrollen', 'readwrite');
			const store = ctrlnk.objectStore('kontrollen');
			await store.delete(ctrl.id);
			ctrl.id = newid;
			ctrl.nkid = mvP.id;
			const js = ctrl2Str(ctrl);
			await store.put(js, newid);
			await ctrlnk.done;
		}
	}

	changeIdsLs(mvP: MarkerEntryProps, idChanges: any) {
		console.assert(
			mvP.id == idChanges.oldid.toString(),
			`marker oldid ${mvP.id} != idchanges.oldid ${idChanges.oldid}`
		);
		localStorage.removeItem(mvP.id);
		mvP.id = idChanges.newid.toString();
		const js = mv2DBStr(mvP, false);
		localStorage.setItem(mvP.id, js);
		for (const ctrl of mvP.ctrls || []) {
			const newid = this.findNewId(idChanges, ctrl.id);
			console.assert(newid, `id ${ctrl.id} not found in ${idChanges}`);
			if (!newid) continue;
			localStorage.removeItem('_k_' + ctrl.id);
			ctrl.id = newid;
			ctrl.nkid = mvP.id;
			const js = ctrl2Str(ctrl);
			localStorage.setItem(newid, js);
		}
	}
}
