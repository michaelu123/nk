import { getContext, setContext } from 'svelte';
import { nkDefaultTypes, nkDefaultSpecies } from './fakeDB';
import type { IDBPDatabase } from 'idb';
import { removePath } from './fs';

const MAX_DAYS = 100; // TODO configurable?
const MAX_TIME_MS = MAX_DAYS * 24 * 60 * 60 * 1000;

export interface MarkerEntryProps {
	latLng: number[];
	ctrls: ControlEntry[] | null;
	selected: boolean;
	color: 'green' | 'red';
	lastCleaned: Date | string | null;
	id: string;
	name: string;
	nkType: string;
	comment: string;
	image: string | null;
	createdAt: Date | string | null;
	changedAt: Date | string | null;
	deletedAt: Date | string | null;
}

export function mv2DBStr(obj: MarkerEntryProps, withCtrls: boolean) {
	const js = JSON.stringify(obj, (k, v) => {
		if (k == 'selected') return undefined;
		if (k == 'color') return undefined;
		if (k == 'lastCleaned') return undefined;
		if (k == 'ctrls' && !withCtrls) return undefined;
		if (k == 'id' && !withCtrls) return undefined;
		return v;
	});
	return js;
}

export class MarkerEntry implements MarkerEntryProps {
	latLng: number[] = $state([]);
	ctrls: ControlEntry[] | null = $state(null);
	selected: boolean = $state(false);
	color: 'green' | 'red' = $state('red');
	lastCleaned: Date | null = $state(null);
	id = '';
	name = $state('');
	nkType = $state('');
	comment = $state('');
	image: string | null = $state(null);
	createdAt: Date | null = null;
	changedAt: Date | null = null;
	deletedAt: Date | null = null;

	constructor(data: MarkerEntryProps) {
		this.updateMarkerEntry(data);
	}

	updateMarkerEntry(data: MarkerEntryProps) {
		this.latLng = data.latLng;
		this.ctrls = data.ctrls;
		this.selected = data.selected;
		this.color = data.color;
		this.id = data.id;
		this.name = data.name;
		this.nkType = data.nkType;
		this.comment = data.comment;
		this.image = data.image;
		this.createdAt = typeof data.createdAt == 'string' ? new Date(data.createdAt) : data.createdAt;
		this.changedAt = typeof data.changedAt == 'string' ? new Date(data.changedAt) : data.changedAt;
		this.deletedAt = typeof data.deletedAt == 'string' ? new Date(data.deletedAt) : data.deletedAt;
	}

	toObj(): MarkerEntryProps {
		let obj: MarkerEntryProps = {
			latLng: this.latLng,
			ctrls: null,
			selected: false,
			color: this.color,
			lastCleaned: this.lastCleaned,
			id: this.id,
			name: this.name,
			nkType: this.nkType,
			comment: this.comment,
			image: this.image,
			createdAt: this.createdAt,
			changedAt: this.changedAt,
			deletedAt: this.deletedAt
		};
		return obj;
	}

	mv2str() {
		const obj = this.toObj();
		const js = JSON.stringify(obj, (k, v) => {
			if (k == 'ctrls') return undefined;
			if (k == 'selected') return undefined;
			if (k == 'color') return undefined;
			if (k == 'lastCleaned') return undefined;
			return v;
		});
		return js;
	}

	setColor() {
		let now = Date.now();
		if (!this.lastCleaned) {
			this.color = 'red';
		} else {
			this.color = now - this.lastCleaned.valueOf() < MAX_TIME_MS ? 'green' : 'red';
		}
	}
}

type UpdatableMarkerFields = {
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
	date: Date;
	species: string | null;
	comment: string | null;
	image: string | null;
	cleaned: boolean;
	createdAt: Date | string;
	changedAt: Date | string | null;
	deletedAt: Date | string | null;
}

export function ctrl2Str(ctrl: ControlEntry) {
	const js = JSON.stringify(ctrl, (k, v) => {
		if (k == 'id') return undefined;
		return v;
	});
	return js;
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

export interface StateProps {
	user: User | null | undefined;
	idb: IDBPDatabase | null;
	bucket: any | null;
	rootDir: FileSystemDirectoryEntry | null | undefined;
}

let mucLat = 48.137236594542834,
	mucLng = 11.576174072626772;

export class State implements StateProps {
	user = $state<User | null | undefined>(null);
	idb: IDBPDatabase | null = null;
	bucket: any | null = null;
	rootDir: FileSystemDirectoryEntry | null | undefined = null;

	defaultCenter = $state([mucLat, mucLng]);
	defaultZoom = $state(16);
	markerValues = $state<MarkerEntry[]>([]);
	maxBounds = $state([
		[48.21736966757146, 11.411914216629935],
		[48.0478968379877, 11.702028367388204]
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
		this.bucket = data.bucket;
		this.rootDir = data.rootDir;
		// keep a ref to bucket, so that it does not close
		this.fetchData();
	}

	getLocalStorageKeys(nk: boolean): string[] {
		let res: string[] = [];
		const len = localStorage.length;
		for (let i = 0; i < len; i++) {
			const k = localStorage.key(i);
			if (k) {
				if (nk) {
					if (k.startsWith('_')) continue;
				} else {
					if (!k.startsWith('_k_')) continue;
				}
				res.push(k);
			}
		}
		return res;
	}

	async fetchOccData(which: 'nktypes' | 'nkspecies') {
		let occs: string[] = [];
		const occval = this.idb
			? await this.idb.get('settings', which)
			: localStorage.getItem('_' + which);
		if (occval) {
			occs = JSON.parse(occval);
		} else {
			// seed occs
			const occs = which == 'nktypes' ? nkDefaultTypes : nkDefaultSpecies;
			const js = JSON.stringify(occs);
			console.log('upd js', js, which);
			if (this.idb) {
				try {
					await this.idb.put('settings', js, which);
				} catch (e: any) {
					console.log('err idb.put', e);
				}
			} else {
				localStorage.setItem('_' + which, js);
			}
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

	async fetchMarkersData(): Promise<MarkerEntry[]> {
		const mvals: MarkerEntry[] = [];
		let keys = this.idb
			? (await this.idb.getAllKeys('nk')).map((k) => k.toString())
			: this.getLocalStorageKeys(true);

		for (let key of keys) {
			const val = this.idb ? await this.idb.get('nk', key) : localStorage.getItem(key);
			const mv = new MarkerEntry(JSON.parse(val) as MarkerEntryProps);
			mv.id = key;
			mvals.push(mv);
			this.updNkTypes(mv.nkType);
		}
		return mvals;
	}

	async fetchMarkersProps(): Promise<MarkerEntryProps[]> {
		const mvals: MarkerEntryProps[] = [];
		let keys = this.idb
			? (await this.idb.getAllKeys('nk')).map((k) => k.toString())
			: this.getLocalStorageKeys(true);

		for (let key of keys) {
			const val = this.idb ? await this.idb.get('nk', key) : localStorage.getItem(key);
			const mv = JSON.parse(val) as MarkerEntryProps;
			mv.id = key;
			mvals.push(mv);
		}
		return mvals;
	}

	async fetchCtrlsProps(mvals: MarkerEntryProps[]) {
		const markerMap: Map<string, MarkerEntryProps> = new Map();
		for (let mv of mvals) {
			markerMap.set(mv.id, mv);
		}
		let keys = this.idb
			? (await this.idb.getAllKeys('kontrollen')).map((k) => k.toString())
			: this.getLocalStorageKeys(false);
		for (let key of keys) {
			const val = this.idb ? await this.idb.get('kontrollen', key) : localStorage.getItem(key);
			const ctrl = JSON.parse(val) as ControlEntry;
			ctrl.id = key;
			ctrl.date = new Date(ctrl.date);
			let mv = markerMap.get(ctrl.nkid);
			if (mv) {
				if (!mv.ctrls) mv.ctrls = [];
				mv.ctrls.push(ctrl);
			} else {
				console.log('no marker for control ' + JSON.stringify(ctrl));
			}
		}
	}

	async fetchCenterData() {
		const cval = this.idb
			? await this.idb.get('settings', 'center')
			: localStorage.getItem('_center');
		if (cval) {
			const center = JSON.parse(cval) as number[];
			this.defaultCenter = center;
		}
	}

	async fetchData() {
		this.isLoading = true;
		try {
			// await new Promise((r) => setTimeout(r, 2000));
			await this.fetchOccData('nktypes');
			await this.fetchOccData('nkspecies');
			const mvals = await this.fetchMarkersData();
			await this.fetchCtrlsData(mvals, false);
			await this.fetchCenterData();
			this.markerValues = mvals;
		} finally {
			this.isLoading = false;
		}
		console.log('nktypes', $state.snapshot(this.nkTypes));
		console.log('nkspecs', $state.snapshot(this.nkSpecies));
	}

	async importMV(mv: MarkerEntry) {
		this.markerValues.push(mv);
		await this.storeMv(mv);
	}

	async storeCtrl(ctrl: ControlEntry) {
		const js = ctrl2Str(ctrl);
		if (this.idb) {
			try {
				await this.idb.put('kontrollen', js, ctrl.id);
			} catch (e: any) {
				console.log('err idb.put', e);
			}
		} else {
			localStorage.setItem('_k_' + ctrl.id, js);
		}
	}

	async fetchCtrlsData(mvals: MarkerEntry[], forSync: boolean) {
		const markerMap: Map<string, MarkerEntry> = new Map();
		for (let mv of mvals) {
			markerMap.set(mv.id, mv);
		}
		let keys = this.idb
			? (await this.idb.getAllKeys('kontrollen')).map((k) => k.toString())
			: this.getLocalStorageKeys(false);
		for (let key of keys) {
			const val = this.idb ? await this.idb.get('kontrollen', key) : localStorage.getItem(key);
			const ctrl = JSON.parse(val) as ControlEntry;
			ctrl.id = key;
			if (!forSync && ctrl.deletedAt) continue;
			ctrl.date = new Date(ctrl.date);
			let mv = markerMap.get(ctrl.nkid);
			if (mv) {
				if (!mv.ctrls) mv.ctrls = [];
				mv.ctrls.push(ctrl);
				if (ctrl.cleaned && (!mv.lastCleaned || ctrl.date > mv.lastCleaned)) {
					mv.lastCleaned = ctrl.date;
				}
				if (ctrl.species) this.updNkSpecies(ctrl.species);
			} else {
				console.log('no marker for control ' + JSON.stringify(ctrl));
			}
		}
		for (let mv of mvals) {
			mv.setColor();
			if (mv.ctrls && mv.ctrls.length > 1) {
				mv.ctrls = mv.ctrls.toSorted((b, a) => a.date.valueOf() - b.date.valueOf());
			}
		}
	}

	async deleteMarker(index: number) {
		if (index == -1) return;
		const mv = this.markerValues[index];
		const id = mv.id;
		this.markerValues.splice(index, 1);
		// if (this.idb) {
		// 	await this.idb!.delete('nk', id);
		// } else {
		// 	localStorage.removeItem(id);
		// }
		const today = new Date();
		today.setMilliseconds(0);
		mv.deletedAt = today;
		this.persistNK(mv, {});
		const image = mv.image;
		if (this.rootDir && image) await removePath(this.rootDir, image);
		for (const ctrl of mv.ctrls ?? []) {
			// if (this.idb) {
			// 	await this.idb.delete('kontrollen', ctrl.id);
			// } else {
			// 	localStorage.removeItem(ctrl.id);
			// }
			ctrl.deletedAt = today;
			const image = ctrl.image;
			this.persistCtrl(mv, ctrl, {});
			if (this.rootDir && image) await removePath(this.rootDir, image);
		}
	}

	async updDefaultCenter(center: number[], zoom: number) {
		// this.defaultCenter = center; //  does not trigger state change!?
		this.defaultCenter = center;
		this.defaultZoom = zoom;
		const js = JSON.stringify(this.defaultCenter);
		console.log('upd js', js, 'center', center, 'dc', this.defaultCenter);
		if (this.idb) {
			await this.idb.put('settings', js, 'center');
		} else {
			localStorage.setItem('_center', js);
		}
	}

	async storeMv(mv: MarkerEntry) {
		const js = mv.mv2str();
		if (this.idb) {
			try {
				await this.idb.put('nk', js, mv.id);
			} catch (e: any) {
				console.log('err idb.put', e);
			}
		} else {
			localStorage.setItem(mv.id, js);
		}
	}

	async persistNK(mv: MarkerEntry, updateObject: Partial<UpdatableMarkerFields>) {
		for (const key of Object.keys(updateObject)) {
			if (key == 'latLng') mv.latLng = updateObject.latLng!;
			if (key == 'name') mv.name = updateObject.name!;
			if (key == 'nkType') mv.nkType = updateObject.nkType!;
			if (key == 'image') mv.image = updateObject.image!;
			if (key == 'comment') mv.comment = updateObject.comment!;
		}
		mv.changedAt = new Date();
		mv.changedAt.setMilliseconds(0);

		await this.storeMv(mv);
	}

	async persistCtrl(
		mv: MarkerEntry,
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

		mv.lastCleaned = null;
		for (let c of mv.ctrls!) {
			if (c.cleaned && (!mv.lastCleaned || c.date > mv.lastCleaned)) {
				mv.lastCleaned = c.date;
			}
		}
		mv.setColor();
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

	async addPhoto(mvid: string, ctrlid: string | null, path: string) {
		const mv = this.markerValues.find((m) => m.id == mvid);
		if (mv) {
			if (ctrlid) {
				const ctrl = mv.ctrls?.find((c) => c.id == ctrlid);
				if (ctrl) {
					this.persistCtrl(mv, ctrl, { image: path });
				} else {
					console.log(`cannot find ctrlid ${ctrlid} for marker ${mvid} and image in ${path}`);
				}
				return;
			}
			await this.persistNK(mv, { image: path });
		} else {
			console.log(`cannot find nkid ${mvid} for image in ${path}`);
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
