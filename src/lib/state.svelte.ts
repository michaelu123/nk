import { getContext, setContext } from 'svelte';
import { nkDefaultTypes, nkDefaultSpecies } from './fakeDB';
import type { IDBPDatabase } from 'idb';

export interface MarkerProps {
	id: string;
	name: string;
	nkType: string;
	comment: string;
	image: string | null;
	lastCleaned: Date | null;
	createdAt: Date;
	changedAt: Date | null;
}

export interface MarkerEntry {
	latLng: number[];
	mrk: any | null;
	ctrls: ControlEntry[] | null;
	selected: boolean;
	color: 'green' | 'red';
	dbFields: MarkerProps;
}

// type UpdatableMarkerFields = Omit<
// 	MarkerEntry | MarkerProps,
// 	'mrk' | 'selected' | 'color' | 'dbFields' | 'id'
// >;
type UpdatableMarkerFields = {
	latLng: number[];
	name: string;
	nkType: string;
	comment: string;
};

export interface ControlEntry {
	id: string;
	nkid: string;
	name: string;
	date: Date;
	species: string | null;
	comment: string | null;
	image: string | null;
	createdAt: Date;
	changedAt: Date | null;
}
type UpdatableControlFields = {
	species: string | null;
	comment: string | null;
	image: string | null;
};

export interface User {
	id: string;
	username: string;
}

export interface StateProps {
	user: User | null;
	idb: IDBPDatabase | null;
	bucket: any | null;
}

let mucLat = 48.137236594542834,
	mucLng = 11.576174072626772;

export class State implements StateProps {
	user = $state<User | null>(null);
	idb: IDBPDatabase | null = null;
	bucket: any | null = null;

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
		this.bucket = data.bucket; // keep a ref to bucket, so that it does not close
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
		let oneSeen = false;
		for (let key of keys) {
			if (key.toString() == 'one') oneSeen = true;
		}

		// seed Markers
		// if (!oneSeen) {
		// 	for (let mv of markerVals) {
		// 		const js = JSON.stringify(mv, (k, v) => {
		// 			if (k == 'mrk') return undefined;
		// 			return v;
		// 		});
		// 		if (this.idb) {
		// 			await this.idb.put('nk', js, mv.dbFields.id);
		// 		} else {
		// 			localStorage.setItem(mv.dbFields.id, js);
		// 		}
		// 	}
		// 	keys = this.idb
		// 		? (await this.idb!.getAllKeys('nk')).map((k) => k.toString())
		// 		: this.getLocalStorageKeys(true);
		// }

		for (let key of keys) {
			const val = this.idb ? await this.idb.get('nk', key) : localStorage.getItem(key);
			const mv = JSON.parse(val) as MarkerEntry;
			mvals.push(mv);
			this.updNkTypes(mv.dbFields.nkType);
		}
		return mvals;
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
			await this.fetchOccData('nktypes');
			await this.fetchOccData('nkspecies');
			const mvals = await this.fetchMarkersData();
			await this.fetchCtrlsData(mvals);
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

	async importCtrl(ctrl: ControlEntry) {
		const js = JSON.stringify(ctrl);
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

	async fetchCtrlsData(mvals: MarkerEntry[]) {
		const markerMap: Map<string, MarkerEntry> = new Map();
		for (let mv of mvals) {
			markerMap.set(mv.dbFields.id, mv);
		}
		let keys = this.idb
			? (await this.idb.getAllKeys('kontrollen')).map((k) => k.toString())
			: this.getLocalStorageKeys(false);

		for (let key of keys) {
			const val = this.idb ? await this.idb.get('kontrollen', key) : localStorage.getItem(key);
			const ctrl = JSON.parse(val) as ControlEntry;
			ctrl.date = new Date(ctrl.date);
			let mv = markerMap.get(ctrl.nkid);
			if (mv) {
				if (!mv.ctrls) mv.ctrls = [];
				mv.ctrls.push(ctrl);
				if (!mv.dbFields.lastCleaned || ctrl.date > mv.dbFields.lastCleaned) {
					mv.dbFields.lastCleaned = ctrl.date;
				}
				if (ctrl.species) this.updNkSpecies(ctrl.species);
			} else {
				console.log('no marker for control ' + JSON.stringify(ctrl));
			}
		}
		let now = Date.now();
		const MAX_DAYS = 100; // TODO configurable?
		const MAX_TIME_MS = MAX_DAYS * 24 * 60 * 60 * 1000;
		for (let mv of mvals) {
			if (mv.ctrls && mv.ctrls.length > 0) {
				mv.ctrls = mv.ctrls.toSorted((b, a) => a.date.valueOf() - b.date.valueOf());
				mv.color = now - mv.ctrls[0].date.valueOf() < MAX_TIME_MS ? 'green' : 'red';
			}
		}
	}

	addMarker(ll: any): string {
		const today = new Date();
		const id = today.valueOf().toString();
		this.markerValues.push({
			latLng: [ll.lat, ll.lng],
			mrk: null,
			ctrls: [],
			selected: false,
			color: 'green',
			dbFields: {
				id,
				name: '',
				nkType: '',
				comment: '',
				image: null,
				lastCleaned: today,
				createdAt: today,
				changedAt: null
			}
		});
		console.log('addMarker mvlen', this.markerValues.length);
		return id;
	}

	async deleteMarker(index: number) {
		if (index == -1) return;
		const mv = this.markerValues[index];
		const id = mv.dbFields.id;
		this.markerValues.splice(index, 1);
		if (this.idb) {
			await this.idb!.delete('nk', id);
		} else {
			localStorage.removeItem(id);
		}
		for (const ctrl of mv.ctrls ?? []) {
			if (this.idb) {
				await this.idb!.delete('kontrollen', ctrl.id);
			} else {
				localStorage.removeItem(ctrl.id);
			}
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
		const js = JSON.stringify(mv, (k, v) => {
			if (k == 'mrk') return undefined;
			if (k == 'ctrls') return undefined;
			return v;
		});
		if (this.idb) {
			try {
				await this.idb.put('nk', js, mv.dbFields.id);
			} catch (e: any) {
				console.log('err idb.put', e);
			}
		} else {
			localStorage.setItem(mv.dbFields.id, js);
		}
	}

	async persistNK(mv: MarkerEntry, updateObject: Partial<UpdatableMarkerFields>) {
		for (const key of Object.keys(updateObject)) {
			if (key == 'latLng') mv.latLng = updateObject.latLng!;
			if (key == 'name') mv.dbFields.name = updateObject.name!;
			if (key == 'nkType') mv.dbFields.nkType = updateObject.nkType!;
			if (key == 'comment') mv.dbFields.comment = updateObject.comment!;
		}
		mv.dbFields.changedAt = new Date();
		await this.storeMv(mv);
	}

	async storeCtrl(ctrl: ControlEntry) {
		const js = JSON.stringify(ctrl);
		if (this.idb) {
			try {
				await this.idb.put('Kontrolle', js, ctrl.id);
			} catch (e: any) {
				console.log('err idb.put', e);
			}
		} else {
			localStorage.setItem('_k_' + ctrl.id, js);
		}
	}

	async persistCtrl(ctrl: ControlEntry, updateObject: Partial<UpdatableControlFields>) {
		for (const key of Object.keys(updateObject)) {
			if (key == 'species') ctrl.species = updateObject.species!;
			if (key == 'comment') ctrl.comment = updateObject.comment!;
		}
		ctrl.changedAt = new Date();
		this.storeCtrl(ctrl);
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
}

const USER_STATE_KEY = Symbol('USER_STATE');

export function setState(data: StateProps) {
	return setContext(USER_STATE_KEY, new State(data));
}

export function getState() {
	return getContext<State>(USER_STATE_KEY);
}
