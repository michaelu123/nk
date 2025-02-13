import { getContext, setContext } from 'svelte';
import { nkDefaultTypes, nkDefaultSpecies } from './fakeDB';
import type { IDBPDatabase } from 'idb';
import { removePath } from './fs';
import { ctrl2Str, date2Str } from './utils';
import { goto } from '$app/navigation';

const MAX_DAYS = 100; // TODO configurable?
const MAX_TIME_MS = MAX_DAYS * 24 * 60 * 60 * 1000;
const mucLat = 48.137236594542834;
const mucLng = 11.576174072626772;

export interface NkEntry {
	latLng: number[];
	ctrls: ControlEntry[] | null;
	selected: boolean;
	color: 'green' | 'red';
	lastCleaned: Date | string | null;
	id: string;
	name: string;
	region: string;
	nkType: string;
	comment: string;
	image: string | null;
	createdAt: Date | string | null;
	changedAt: Date | string | null;
	deletedAt: Date | string | null;
}

export function nkToObj(nk: NkEntry): any {
	let obj = {
		latLng: [...nk.latLng], // "un"state
		id: nk.id,
		name: nk.name,
		region: nk.region,
		nkType: nk.nkType,
		comment: nk.comment,
		image: nk.image,
		createdAt: nk.createdAt,
		changedAt: nk.changedAt,
		deletedAt: nk.deletedAt
	};
	return obj;
}

export function nk2str(nk: NkEntry) {
	const obj = nkToObj(nk);
	const js = JSON.stringify(obj);
	return js;
}

export function setColor(nk: NkEntry) {
	let now = Date.now();
	if (!nk.lastCleaned) {
		nk.color = 'red';
	} else {
		nk.color = now - (nk.lastCleaned as Date).valueOf() < MAX_TIME_MS ? 'green' : 'red';
	}
}

type UpdatableNkFields = {
	latLng: number[];
	name: string;
	nkType: string;
	comment: string;
	image: string;
};

export interface ControlEntry {
	id: string;
	nkid: string;
	name: string;
	region: string;
	date: Date;
	species: string | null;
	comment: string | null;
	image: string | null;
	cleaned: boolean;
	createdAt: Date | string;
	changedAt: Date | string | null;
	deletedAt: Date | string | null;
}

export function ctrlToObj(ctrl: ControlEntry): any {
	let obj = {
		id: ctrl.id,
		nkid: ctrl.nkid,
		name: ctrl.name,
		region: ctrl.region,
		date: date2Str(ctrl.date),
		species: ctrl.species,
		comment: ctrl.comment,
		image: ctrl.image,
		cleaned: ctrl.cleaned,
		createdAt: date2Str(ctrl.createdAt),
		changedAt: date2Str(ctrl.changedAt),
		deletedAt: date2Str(ctrl.deletedAt)
	};
	return obj;
}

type UpdatableControlFields = {
	species: string | null;
	comment: string | null;
	image: string | null;
	cleaned: boolean;
};

export interface User {
	id: string;
	username: string;
}

export interface Region {
	name: string;
	shortName: string;
	lowerLeft: number[];
	upperRight: number[];
	center: number[];
}

export interface StateProps {
	user: User | null;
	idb: IDBPDatabase | null;
	bucket: any | null;
	rootDir: FileSystemDirectoryEntry | null;
	region: Region | null;
	regions: Region[] | null;
	selectedRegion: string | null;
}

export class State implements StateProps {
	user = $state<User | null>(null);
	idb: IDBPDatabase | null = null;
	bucket: any | null = null;
	rootDir: FileSystemDirectoryEntry | null = null;

	static regionDefault: Region = {
		name: 'default',
		shortName: 'dflt',
		lowerLeft: [mucLat + 0.1, mucLng - 0.1],
		upperRight: [mucLat - 0.1, mucLng + 0.1],
		center: [mucLat, mucLng]
	};

	regions: Region[] = $state([]);
	region: Region | null = $state(null);
	selectedRegion: string | null = $state(null);

	defaultCenter = $state(this.region ? this.region.center : State.regionDefault.center);
	defaultZoom = $state(16);
	nkValues = $state<NkEntry[]>([]);
	maxBounds = $derived([
		this.region ? this.region.lowerLeft : State.regionDefault.lowerLeft,
		this.region ? this.region.upperRight : State.regionDefault.upperRight
	]);
	nkTypes: Map<string, number> = $state(new Map());
	nkSpecies: Map<string, number> = $state(new Map());
	isLoading = $state(false);

	constructor(data: StateProps) {
		this.updateState(data);
	}

	updateState(data: StateProps) {
		this.user = data.user;
		this.idb = data.idb;
		this.bucket = data.bucket; // keep a ref to bucket, so that it does not close
		this.rootDir = data.rootDir;
		this.region = data.region;
		this.regions = data.regions || [];
		this.selectedRegion = data.selectedRegion;
	}

	updateRegion(
		regionIdb: Region | null | undefined,
		selectedRegion: string | null | undefined,
		regionsIdb: Region[] | null | undefined
	) {
		this.region = regionIdb ?? null;
		this.regions = regionsIdb || [];
		this.selectedRegion = selectedRegion ?? null;
	}

	getLocalStorageKeys(nk: boolean): string[] {
		let res: string[] = [];
		const len = localStorage.length;
		for (let i = 0; i < len; i++) {
			const k = localStorage.key(i);
			if (k) {
				// _k_ : ctrl entry, _ : settings entry, nk without _
				if (nk) {
					if (!k.startsWith(this.selectedRegion!)) continue;
				} else {
					if (!k.startsWith('_k_' + this.selectedRegion)) continue;
				}
				res.push(k);
			}
		}
		return res;
	}

	async fetchOccData(which: 'nktypes' | 'nkspecies') {
		let occs: string[] = [];
		if (this.idb) {
			occs = await this.idb.get('settings', which);
		} else {
			const occJS = localStorage.getItem('_' + which);
			occs = JSON.parse(occJS || '[]');
		}
		if (!occs || occs.length == 0) {
			// seed occs
			const occs = which == 'nktypes' ? nkDefaultTypes : nkDefaultSpecies;
			this.storeSettings(which, occs);
		}
		if (which == 'nktypes') {
			for (const occ of occs) {
				this.nkTypes.set(occ, 0);
			}
		} else {
			for (const occ of occs) {
				this.nkSpecies.set(occ, 0);
			}
		}
	}

	async fetchNks(forSync: boolean): Promise<NkEntry[]> {
		const nkVals: NkEntry[] = [];
		let keys = this.idb
			? (
					await this.idb.getAllKeysFromIndex(
						'nk',
						'nkRegionIndex',
						IDBKeyRange.only(this.selectedRegion)
					)
				).map((k) => k.toString())
			: this.getLocalStorageKeys(true);

		for (let key of keys) {
			const val = this.idb ? await this.idb.get('nk', key) : localStorage.getItem(key);
			const nk = (this.idb ? val : JSON.parse(val)) as NkEntry;
			if (!forSync && nk.deletedAt) continue;
			nk.id = key;
			nkVals.push(nk);
			if (!forSync) this.updNkTypes(nk.nkType);
		}
		return nkVals;
	}

	async fetchCtrls(nkVals: NkEntry[], forSync: boolean) {
		const nkMap: Map<string, NkEntry> = new Map();
		for (let nk of nkVals) {
			nkMap.set(nk.id, nk);
		}
		let keys = this.idb
			? (
					await this.idb.getAllKeysFromIndex(
						'kontrollen',
						'nkRegionIndex',
						IDBKeyRange.only(this.selectedRegion)
					)
				).map((k) => k.toString())
			: this.getLocalStorageKeys(false);
		for (let key of keys) {
			const val = this.idb ? await this.idb.get('kontrollen', key) : localStorage.getItem(key);
			const ctrl = (this.idb ? val : JSON.parse(val)) as ControlEntry;
			ctrl.id = key;
			if (!forSync && ctrl.deletedAt) continue;
			ctrl.date = new Date(ctrl.date);
			let nk = nkMap.get(ctrl.nkid);
			if (nk) {
				if (!nk.ctrls) nk.ctrls = [];
				nk.ctrls.push(ctrl);
				if (ctrl.cleaned && (!nk.lastCleaned || ctrl.date > nk.lastCleaned)) {
					nk.lastCleaned = ctrl.date;
				}
				if (ctrl.species && !forSync) this.updNkSpecies(ctrl.species);
			} else {
				console.log('no nk for control ' + JSON.stringify(ctrl));
			}
		}
		if (!forSync) {
			for (let nk of nkVals) {
				setColor(nk);
				if (nk.ctrls && nk.ctrls.length > 1) {
					nk.ctrls = nk.ctrls.toSorted((b, a) => a.date.valueOf() - b.date.valueOf());
				}
			}
		}
	}

	async fetchCenterData() {
		const cval = this.idb
			? await this.idb.get('settings', 'center')
			: localStorage.getItem('_center');
		if (cval) {
			const center = (this.idb ? cval : JSON.parse(cval)) as number[];
			this.defaultCenter = center;
		}
	}

	async fetchRegionData() {
		const rval = this.idb
			? await this.idb.get('settings', 'regions')
			: localStorage.getItem('_regions');
		if (rval) {
			this.regions = (this.idb ? rval : JSON.parse(rval)) as Region[];
		}
		const selectedRegion = this.idb
			? await this.idb.get('settings', 'selectedRegion')
			: localStorage.getItem('_selectedRegion');
		this.region = this.regions.find((r) => r.shortName == selectedRegion) || State.regionDefault;
	}

	async fetchData() {
		this.isLoading = true;
		try {
			// await new Promise((r) => setTimeout(r, 2000));
			await this.fetchRegionData();
			await this.fetchOccData('nktypes');
			await this.fetchOccData('nkspecies');
			const nkVals = await this.fetchNks(false);
			await this.fetchCtrls(nkVals, false);
			await this.fetchCenterData();
			this.nkValues = nkVals;
		} finally {
			this.isLoading = false;
		}
		// console.log('nktypes', $state.snapshot(this.nkTypes));
		// console.log('nkspecs', $state.snapshot(this.nkSpecies));
	}

	async importNk(nk: NkEntry) {
		this.nkValues.push(nk);
		await this.storeNk(nk);
	}

	async storeCtrl(ctrl: ControlEntry) {
		if (this.idb) {
			try {
				const obj = ctrlToObj(ctrl);
				await this.idb.put('kontrollen', obj, ctrl.id.toString());
			} catch (e: any) {
				console.log('err idb.put', e);
			}
		} else {
			const js = ctrl2Str(ctrl, true);
			localStorage.setItem('_k_' + this.selectedRegion + '_' + ctrl.id, js);
		}
	}

	async deleteNk(index: number) {
		if (index == -1) return;
		const nk = this.nkValues[index];
		const id = nk.id;
		this.nkValues.splice(index, 1);
		// if (this.idb) {
		// 	await this.idb!.delete('nk', id);
		// } else {
		// 	localStorage.removeItem(id);
		// }
		const today = new Date();
		today.setMilliseconds(0);
		nk.deletedAt = today;
		this.persistNK(nk, {});
		const image = nk.image;
		if (this.rootDir && image) await removePath(this.rootDir, image);
		for (const ctrl of nk.ctrls ?? []) {
			// if (this.idb) {
			// 	await this.idb.delete('kontrollen', ctrl.id);
			// } else {
			// 	localStorage.removeItem(ctrl.id);
			// }
			ctrl.deletedAt = today;
			const image = ctrl.image;
			this.persistCtrl(nk, ctrl, {});
			if (this.rootDir && image) await removePath(this.rootDir, image);
		}
	}

	async updDefaultCenter(center: number[], zoom: number) {
		this.defaultCenter = center;
		this.defaultZoom = zoom;
		this.storeSettings('center', [...center]); // "unstate" if center is a $state variable
	}

	async storeNk(nk: NkEntry) {
		if (this.idb) {
			try {
				const obj = nkToObj(nk);
				await this.idb.put('nk', obj, nk.id);
			} catch (e: any) {
				console.log('err idb.put', e);
			}
		} else {
			const js = nk2str(nk);
			localStorage.setItem(this.selectedRegion + '_' + nk.id, js);
		}
	}

	async persistNK(nk: NkEntry, updateObject: Partial<UpdatableNkFields>) {
		for (const key of Object.keys(updateObject)) {
			if (key == 'latLng') nk.latLng = updateObject.latLng!;
			if (key == 'name') nk.name = updateObject.name!;
			if (key == 'nkType') nk.nkType = updateObject.nkType!;
			if (key == 'image') nk.image = updateObject.image!;
			if (key == 'comment') nk.comment = updateObject.comment!;
		}
		nk.changedAt = new Date();
		nk.changedAt.setMilliseconds(0);

		await this.storeNk(nk);
	}

	async persistCtrl(
		nk: NkEntry,
		ctrl: ControlEntry,
		updateObject: Partial<UpdatableControlFields>
	) {
		for (const key of Object.keys(updateObject)) {
			if (key == 'species') ctrl.species = updateObject.species!;
			if (key == 'comment') ctrl.comment = updateObject.comment!;
			if (key == 'cleaned') ctrl.cleaned = updateObject.cleaned!;
			if (key == 'image') ctrl.image = updateObject.image!;
		}
		ctrl.changedAt = new Date();
		ctrl.changedAt.setMilliseconds(0);

		await this.storeCtrl(ctrl);

		nk.lastCleaned = null;
		for (let c of nk.ctrls!) {
			if (c.cleaned && (!nk.lastCleaned || c.date > nk.lastCleaned)) {
				nk.lastCleaned = c.date;
			}
		}
		setColor(nk);
	}

	updNkTypes(nkType: string) {
		if (!nkType) return;
		let count = this.nkTypes.get(nkType);
		if (count) {
			this.nkTypes.set(nkType, count + 1);
		} else {
			this.nkTypes.set(nkType, 1);
		}
	}

	updNkSpecies(nkSpec: string) {
		if (!nkSpec) return;
		let count = this.nkSpecies.get(nkSpec);
		if (count) {
			this.nkSpecies.set(nkSpec, count + 1);
		} else {
			this.nkSpecies.set(nkSpec, 1);
		}
	}

	async addPhoto(nkid: string, ctrlid: string | null, path: string) {
		const nk = this.nkValues.find((m) => m.id == nkid);
		if (nk) {
			if (ctrlid) {
				const ctrl = nk.ctrls?.find((c) => c.id == ctrlid);
				if (ctrl) {
					this.persistCtrl(nk, ctrl, { image: path });
				} else {
					console.log(`cannot find ctrlid ${ctrlid} for marker ${nkid} and image in ${path}`);
				}
				return;
			}
			await this.persistNK(nk, { image: path });
		} else {
			console.log(`cannot find nkid ${nkid} for image in ${path}`);
		}
	}

	async addOrUpdateRegion(newRegion: Region) {
		let found = false;
		for (const r of this.regions) {
			if (r.shortName == newRegion.shortName) {
				r.name = newRegion.name;
				r.lowerLeft = newRegion.lowerLeft;
				r.upperRight = newRegion.upperRight;
				found = true;
				break;
			}
		}
		if (!found) {
			this.regions.push(newRegion);
		}
		await this.storeSettings('regions', $state.snapshot(this.regions));
		await this.selectRegion(newRegion.shortName);
	}

	async selectRegion(sname: string): Promise<number[]> {
		const rg = this.regions.find((r) => r.shortName == sname) || State.regionDefault;
		const center = rg.center;
		await this.updDefaultCenter(center, 16);
		this.selectedRegion = rg.shortName;
		this.region = rg;
		await this.storeSettings('selectedRegion', rg.shortName);
		return center;
	}

	async deleteRegion(sname: string) {
		const x = this.regions.findIndex((r) => r.shortName == sname);
		if (x != -1) {
			this.regions.splice(x);
			await this.storeSettings('regions', $state.snapshot(this.regions));
			this.selectedRegion = null;
			await this.storeSettings('selectedRegion', null);
			await goto('/region');
		}
	}

	async storeSettings(key: string, val: any) {
		if (this.idb) {
			try {
				await this.idb.put('settings', val, key);
			} catch (e: any) {
				console.log('err idb.put', e);
				console.log('err val', val);
			}
		} else {
			const valS = typeof val == 'string' ? val : JSON.stringify(val);
			localStorage.setItem('_' + key, valS);
		}
	}

	static async storeSettings(
		idb: IDBPDatabase<unknown> | null,
		key: string,
		val: any
	): Promise<void> {
		if (idb) {
			try {
				await idb.put('settings', val, key);
			} catch (e: any) {
				console.log('err idb.put', e);
				console.log('err val', val);
			}
		} else {
			const valS = typeof val == 'string' ? val : JSON.stringify(val);
			localStorage.setItem('_' + key, valS);
		}
	}
}

const USER_STATE_KEY = Symbol('USER_STATE');

export function setState(data: StateProps) {
	return setContext(USER_STATE_KEY, new State(data));
}

export function getState() {
	return getContext<State>(USER_STATE_KEY);
}
