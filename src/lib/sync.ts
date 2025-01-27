import type { IDBPDatabase } from 'idb';
import { type ControlEntry, type MarkerEntryProps, type Region, type State } from './state.svelte';
import { lastChanged, mv2DBStr, sleep } from './utils';
import { createDirsFor, createFile, createWriter, existsFS, fetchBlob, writeFile } from './fs';
import type { RegionsDbSelect } from './server/db/schema';

interface IdAndChanged {
	id: string;
	lastChanged: string;
	image: string | null;
}

// who has newer data, server or client?
// both occurs, if some new controls on both.
const cmp_client = 1;
const cmp_server = 2;
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
	private imgFromCnt = 0;
	private imgToCnt = 0;
	private nkCount = 0;
	private ctrlsCount = 0;
	private shortName = '';

	constructor(nkState: State, fetch: Function, setProgress: Function) {
		this.nkState = nkState;
		this.fetch = fetch;
		this.setProgress = setProgress;
		this.idb = nkState.idb;
	}

	async toServer(): Promise<number> {
		const scMap = new Map<string, ServerChanges>(); // lastChanged date of db entries
		const csMap = new Map<string, CmpResult>(); // client: newer or new on client

		const chgResponse = await this.fetch('/api/db?what=chg&region=' + this.shortName, {
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
			const cmpRes = await this.compareChanges(mvP, scMap.get(mvP.id) ?? null);
			csMap.set(mvP.id, cmpRes); // may overwrite entries set to server above
		}
		csMap.forEach((v, k) => {
			if (v.imgFromServer.length != 0 || v.imgToServer.length != 0) return;
			if (v.cmp == 0) csMap.delete(k); // no differences, client and server same
			if (v.cmp == cmp_server) csMap.delete(k); // bulk update later
		});
		let len = csMap.size;
		let cnt = 0;
		let toCnt = 0;
		for (const [mvid, cmpRes] of csMap.entries()) {
			const mvP = this.mvalsP.find((m) => m.id == mvid)!;
			console.assert(mvP, 'cannot find NK data for nkid ' + mvid);
			if (cmpRes.cmp & cmp_client) {
				toCnt++;
				await this.storeOnServer(mvP);
			}
			for (const image of cmpRes.imgToServer) {
				await this.postImage(image);
			}
			for (const image of cmpRes.imgFromServer) {
				await this.fetchImageIfNotExists(image);
			}
			cnt++;
			const progress = (cnt / len) * 100;
			this.setProgress(progress);
		}
		return toCnt;
	}

	async fromServer(): Promise<number> {
		// transfer DB to local data
		const nkResponse = await this.fetch('/api/db?what=nk&region=' + this.shortName, {
			// TODO
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});
		const mvals = (await nkResponse.json()) as MarkerEntryProps[];
		const ctrlResponse = await this.fetch('/api/db?what=ctrls&region=' + this.shortName, {
			// TODO
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});
		const ctrls = (await ctrlResponse.json()) as ControlEntry[];

		const len = mvals.length + ctrls.length;
		let fromCnt = len;
		let cnt = 0;
		for (const mvP of mvals) {
			if (this.idb) {
				try {
					const res = await this.idb.put('nk', mvP, mvP.id.toString());
				} catch (e: any) {
					console.log('err idb.put', e);
				}
			} else {
				const js = mv2DBStr(mvP, false);
				localStorage.setItem(this.shortName + '_' + mvP.id, js);
			}
			cnt++;
			this.nkCount++;
			const progress = (cnt / len) * 100;
			this.setProgress(progress);
		}
		for (const ctrl of ctrls) {
			ctrl.id = ctrl.id.toString();
			ctrl.nkid = ctrl.nkid.toString();
			this.nkState.storeCtrl(ctrl);
			cnt++;
			this.ctrlsCount++;
			const progress = (cnt / len) * 100;
			this.setProgress(progress);
		}
		this.nkState.fetchData();
		this.setProgress(0);
		return fromCnt;
	}

	async sync() {
		const counters = new Map<string, any>();
		// TODO await this.storeLoadRegions();
		// clear local data
		await this.clearDb();
		for (const region of this.nkState.regions) {
			this.shortName = region.shortName;
			this.nkState.selectedRegion = region.shortName;
			const scMap = new Map<string, ServerChanges>(); // lastChanged date of db entries
			const csMap = new Map<string, CmpResult>(); // client: newer or new on client
			this.nkCount = 0;
			this.ctrlsCount = 0;

			const toCnt = 0; //  await this.toServer(); TODO

			const fromCnt = this.fromServer();
			await sleep(100);
			counters.set(region.name, { toCnt, fromCnt, nkCnt: this.nkCount, ctrlCnt: this.ctrlsCount });
		}

		// 		alert(`Datensätze zum Server übertragen: ${toCnt}
		// Datensätze vom Server neu geholt: ${fromCnt}
		// Davon Datensätze für Nistkästen: ${this.mvalsCount}
		// und für Kontrollen: ${this.ctrlsCount}.
		// Bilder zum Server übertragen: ${this.imgToCnt}
		// Bilder vom Server geholt: ${this.imgFromCnt}
		// `);
		alert('data transfers' + JSON.stringify(counters)); // TODO
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
			this.imgToCnt++;
		} catch (e) {
			console.log(`cannot post image ${imgPath} to server: ${e}`);
		}
	}

	async fetchImageIfNotExists(imgPath: string) {
		if (await existsFS(this.nkState.rootDir!, imgPath)) return;
		try {
			const resp1: Response = await this.fetch('/api/db?what=img&imgPath=' + imgPath, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/octet-stream'
				}
			});
			const buf = await resp1.arrayBuffer();
			const blob = new Blob([buf]);
			let dir = await createDirsFor(this.nkState.rootDir!, imgPath);
			const parts = imgPath.split('/');
			let filename = parts[parts.length - 1];
			let f = await createFile(dir, filename);
			let fw = await createWriter(f);
			let total = await writeFile(fw, blob);
			console.log(`wrote image ${imgPath} of length ${total}`);
			this.imgFromCnt++;
		} catch (e) {
			console.log(`cannot get image ${imgPath} from server:${e}`);
		}
	}

	async storeOnServer(mvP: MarkerEntryProps) {
		const js = mv2DBStr(mvP, true);
		const response = await fetch!('/api/db?what=nk&region=' + this.shortName, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: js
		});
	}

	async compareChanges(mvP: MarkerEntryProps, sc: ServerChanges | null): Promise<CmpResult> {
		const imgFromServer: string[] = [];
		const imgToServer: string[] = [];
		let cmp = 0;

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

	async clearDb() {
		if (this.idb) {
			await this.idb.clear('kontrollen');
			await this.idb.clear('nk');
		} else {
			localStorage.clear();
		}
	}

	async removeDuplicates() {
		const dplResponse = await this.fetch('/api/db?what=dpl', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});
		const js = await dplResponse.json();
		console.log('Doubletten gelöscht:', js);
	}

	async storeLoadRegions() {
		const rval = this.idb
			? await this.idb.get('settings', 'regions')
			: localStorage.getItem('_regions');
		const regionsJS = this.idb ? JSON.stringify(rval) : rval;
		try {
			const response = await fetch('/api/db?what=regions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: regionsJS
			});
			if (response.ok) {
				const result = await response.json();
				const resultDB: RegionsDbSelect[] = result;
				console.log('storeRegions res:', result);
				const regions: Region[] = [];
				for (const rdb of resultDB) {
					const data = JSON.parse(rdb.data!);
					const r: Region = {
						name: rdb.regionname,
						shortName: rdb.shortname,
						...data
					};
					regions.push(r);
				}
				this.nkState.storeSettings('regions', regions);
			}
		} catch (e) {
			console.log(`cannot sync regions ${regionsJS} to server: ${e}`);
		}
	}
}
