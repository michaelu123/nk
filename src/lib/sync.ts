import type { IDBPDatabase } from 'idb';
import { type ControlEntry, type MarkerEntryProps, type State } from './state.svelte';
import { lastChanged, mv2DBStr, sleep } from './utils';
import { createDirsFor, createFile, createWriter, existsFS, fetchBlob, writeFile } from './fs';

interface IdAndChanged {
	id: string;
	lastChanged: string;
	image: string | null;
}

// who has newer data, server or client?
// both occurs, if some new controls on both.
const cmp_client = 1;
const cmp_server = 2;
const cmp_img_client = 4;
const cmp_img_server = 8;
type ServerOrClient = number; // bitwise OR of the above

interface CmpResult {
	cmp: ServerOrClient;
	imgFromServer: string[];
	imgToServer: string[];
}

export interface ServerChanges {
	id: number;
	lastChanged: string;
	image: string | null;
	ctrlChanges: {
		id: number;
		lastChanged: string;
		image: string | null;
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
		const csMap = new Map<string, CmpResult>(); // client: newer or new on client

		const chgResponse = await this.fetch('/api/db?what=chg', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});
		const serverChanges = (await chgResponse.json()) as ServerChanges[];
		for (let sc of serverChanges) {
			const idS = sc.id.toString();
			scMap.set(idS, sc);
			const imgFromServer: string[] = [];
			if (sc.image) imgFromServer.push(sc.image);
			for (const sctrl of sc.ctrlChanges) {
				if (sctrl.image) imgFromServer.push(sctrl.image);
			}
			csMap.set(idS, { cmp: cmp_server, imgFromServer, imgToServer: [] });
		}

		this.mvalsP = await this.nkState.fetchMarkersProps(); // including deleted items
		await this.nkState.fetchCtrlsProps(this.mvalsP);

		for (let mvP of this.mvalsP) {
			const cmpRes = await this.compareChanges(mvP, scMap.get(mvP.id));
			csMap.set(mvP.id, cmpRes); // may overwrite entries set to server above
		}
		csMap.forEach((v, k) => {
			if (v.imgFromServer.length != 0 || v.imgToServer.length != 0) return;
			if (v.cmp == 0) csMap.delete(k); // no differences, client and server same
			if (v.cmp == cmp_server) csMap.delete(k); // bulk update later
		});
		let len = csMap.size;
		let cnt = 0;
		let toCnt = len;
		let imgFromCnt = 0;
		let imgToCnt = 0;
		for (const [mvid, cmpRes] of csMap.entries()) {
			const mvP = this.mvalsP.find((m) => m.id == mvid)!;
			console.assert(mvP, 'cannot find NK data for nkid ' + mvid);
			if (cmpRes.cmp & cmp_client) {
				await this.storeOnServer(mvP);
			}
			// if (cmpRes.cmp & cmp_server) { // instead we load everything from scratch
			// 	await this.loadFromServer(mvid);
			// }
			for (const image of cmpRes.imgToServer) {
				await this.postImage(image);
				imgToCnt++;
			}
			for (const image of cmpRes.imgFromServer) {
				await this.fetchImageIfNotExists(image);
				imgFromCnt++;
			}
			cnt++;
			const progress = (cnt / len) * 100;
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
		const nkResponse = await this.fetch('/api/db?what=nk', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});
		const mvals = (await nkResponse.json()) as MarkerEntryProps[];
		const ctrlResponse = await this.fetch('/api/db?what=kn', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});
		const ctrls = (await ctrlResponse.json()) as ControlEntry[];

		len = mvals.length + ctrls.length;
		let fromCnt = len;
		cnt = 0;
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
			cnt++;
			const progress = (cnt / len) * 100;
			this.setProgress(progress);
		}
		for (const ctrl of ctrls) {
			ctrl.id = ctrl.id.toString();
			ctrl.nkid = ctrl.nkid.toString();
			this.nkState.storeCtrl(ctrl);
			cnt++;
			const progress = (cnt / len) * 100;
			this.setProgress(progress);
		}
		this.nkState.fetchData();
		this.setProgress(0);
		await sleep(100);
		alert(`Datensätze zum Server übertragen: ${toCnt}
Datensätze vom Server neu geholt: ${fromCnt}
Davon Datensätze für Nistkästen: ${mvals.length}
und für Kontrollen: ${ctrls.length}.
Bilder zum Server übertragen: ${imgToCnt}
Bilder vom Server geholt: ${imgFromCnt}
`);
	}

	async postImage(imgPath: string) {
		try {
			const blob = await fetchBlob(this.nkState.rootDir!, imgPath);
			const response = await fetch('/api/db?what=img&imgPath=' + imgPath, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/octet-stream'
				},
				body: await blob.arrayBuffer()
			});
			const result = await response.json();
			console.log('postimage res:', result);
		} catch (e) {
			console.log(`cannot post image ${imgPath} to server: ${e}`);
		}
	}

	async fetchImageIfNotExists(imgPath: string) {
		if (await existsFS(this.nkState.rootDir!, imgPath)) return;
		const resp1: Response = await this.fetch('/api/db?what=img&imgPath=' + imgPath, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/octet-stream'
			}
		});
		try {
			const buf = await resp1.arrayBuffer();
			const blob = new Blob([buf]);
			let dir = await createDirsFor(this.nkState.rootDir!, imgPath);
			const parts = imgPath.split('/');
			let filename = parts[parts.length - 1];
			let f = await createFile(dir, filename);
			let fw = await createWriter(f);
			let total = await writeFile(fw, blob);
			console.log(`wrote image ${imgPath} of length ${total}`);
		} catch (e) {
			console.log(`cannot get image ${imgPath} from server:${e}`);
		}
	}

	async storeOnServer(mvP: MarkerEntryProps) {
		const js = mv2DBStr(mvP, true);
		const response = await fetch!('/api/db?what=nk', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: js
		});

		// const idChanges = await response.json();
		// await this.changeIds(mvP, idChanges);
	}

	async compareChanges(mvP: MarkerEntryProps, sc: ServerChanges | undefined): Promise<CmpResult> {
		const imgFromServer: string[] = [];
		const imgToServer: string[] = [];
		let cmp = 0;
		if (mvP.id == '240') {
			console.log('240'); // TODO
		}

		if (!sc) {
			if (mvP.image) imgToServer.push(mvP.image);
			for (const ctrl of mvP.ctrls || []) {
				if (ctrl.image) imgToServer.push(ctrl.image);
			}
			return { cmp: cmp_client, imgFromServer, imgToServer };
		}

		if (mvP.image && (!sc.image || sc.image != mvP.image)) {
			imgToServer.push(mvP.image);
		}
		if (sc.image && !(await existsFS(this.nkState.rootDir!, sc.image))) {
			imgFromServer.push(sc.image);
		}

		const cics = this.convertControlEntriesToICArray(mvP.ctrls || []);
		const sics = this.convertServerChangesControlEntries(sc.ctrlChanges);
		let lc = lastChanged(mvP);
		if (lc < sc.lastChanged) {
			cmp = await this.compareCtrlChanges(cics, sics, cmp_server, imgFromServer, imgToServer);
		} else if (lc > sc.lastChanged) {
			cmp = await this.compareCtrlChanges(cics, sics, cmp_client, imgFromServer, imgToServer);
		} else {
			cmp = await this.compareCtrlChanges(cics, sics, 0, imgFromServer, imgToServer);
		}
		return { cmp, imgFromServer, imgToServer };
	}

	convertControlEntriesToICArray(ctrls: ControlEntry[]): IdAndChanged[] {
		let res: IdAndChanged[] = [];
		for (const ctrl of ctrls || []) {
			let lc = lastChanged(ctrl);
			res.push({ id: ctrl.id, lastChanged: lc, image: ctrl.image });
		}
		return res;
	}

	convertServerChangesControlEntries(
		ctrls: {
			id: number;
			lastChanged: string;
			image: string | null;
		}[]
	): IdAndChanged[] {
		let res: IdAndChanged[] = [];
		for (const ctrl of ctrls || []) {
			res.push({ id: ctrl.id.toString(), lastChanged: ctrl.lastChanged, image: ctrl.image });
		}
		return res;
	}

	async compareCtrlChanges(
		c: IdAndChanged[],
		s: IdAndChanged[],
		cmp: number,
		imgFromServer: string[],
		imgToServer: string[]
	): Promise<ServerOrClient> {
		for (const ce of c) {
			let foundCinS = false;
			for (const se of s) {
				if (ce.id == se.id) {
					foundCinS = true;
					if (ce.image && (!se.image || se.image != ce.image)) {
						imgToServer.push(ce.image);
					}
					if (se.image && !(await existsFS(this.nkState.rootDir!, se.image))) {
						imgFromServer.push(se.image);
					}
					if (ce.lastChanged < se.lastChanged) {
						cmp |= cmp_server;
					}
					if (ce.lastChanged > se.lastChanged) {
						cmp |= cmp_client;
					}
					break;
				}
			}
			if (!foundCinS) {
				cmp |= cmp_client; // client has a control that server does not or is newer
				if (ce.image) {
					if (await existsFS(this.nkState.rootDir!, ce.image)) {
						imgToServer.push(ce.image);
					} else {
						imgFromServer.push(ce.image);
					}
				}
			}
		}
		for (const se of s) {
			let foundSinC = false;
			for (const ce of c) {
				if (se.id == ce.id) {
					foundSinC = true;
					break;
				}
			}
			if (!foundSinC) {
				cmp |= cmp_server; // server has a control that client does not or is newer
				if (se.image) {
					imgFromServer.push(se.image);
				}
			}
		}
		return cmp;
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
	*/
}
