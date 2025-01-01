import { getContext, setContext } from 'svelte';
import { markerVals, nkDefaultTypes } from './fakeDB';
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
	markerValues = $state<MarkerEntry[]>([]);
	maxBounds = $state([
		[48.21736966757146, 11.411914216629935],
		[48.0478968379877, 11.702028367388204]
	]);
	nkTypes: Map<string, number> = $state(new Map());

	constructor(data: StateProps) {
		this.updateState(data);
	}

	updateState(data: StateProps) {
		this.user = data.user;
		this.idb = data.idb;
		this.bucket = data.bucket; // keep a ref to bucket, so that it does not close
		this.fetchUserData();
	}

	getLocalStorageKeys(): string[] {
		let res: string[] = [];
		const len = localStorage.length;
		for (let i = 0; i < len; i++) {
			const k = localStorage.key(i);
			if (k) res.push(k);
		}
		return res;
	}

	async fetchNkTypesData() {
		let nktypes: string[] = [];
		const nval = this.idb
			? await this.idb.get('settings', 'nktypes')
			: localStorage.getItem('_nktypes');
		if (nval) {
			nktypes = JSON.parse(nval);
		} else {
			// seed nktypes
			const nktypes = nkDefaultTypes;
			const js = JSON.stringify(nktypes);
			console.log('upd js', js, 'nktypes', this.nkTypes);
			if (this.idb) {
				try {
					await this.idb.put('settings', js, 'nktypes');
				} catch (e: any) {
					console.log('err idb.put', e);
				}
			} else {
				localStorage.setItem('_nktypes', js);
			}
		}
		for (const nkt of nktypes) {
			this.nkTypes.set(nkt, 0);
		}
	}

	async fetchMarkersData() {
		let keys = this.idb
			? (await this.idb.getAllKeys('nk')).map((k) => k.toString())
			: this.getLocalStorageKeys();
		let oneSeen = false;
		for (let key of keys) {
			if (key.toString() == 'one') oneSeen = true;
		}

		// seed Markers
		if (!oneSeen) {
			for (let mv of markerVals) {
				const js = JSON.stringify(mv, (k, v) => {
					if (k == 'mrk') return undefined;
					return v;
				});
				if (this.idb) {
					await this.idb.put('nk', js, mv.dbFields.id);
				} else {
					localStorage.setItem(mv.dbFields.id, js);
				}
			}
			keys = this.idb
				? (await this.idb!.getAllKeys('nk')).map((k) => k.toString())
				: this.getLocalStorageKeys();
		}

		for (let key of keys) {
			const val = this.idb ? await this.idb.get('nk', key) : localStorage.getItem(key);
			const mv = JSON.parse(val) as MarkerEntry;
			this.markerValues.push(mv);
			this.updNkTypes(mv.dbFields.nkType);
		}
		console.log('fetch nktypes', this.nkTypes);
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

	async fetchUserData() {
		await this.fetchNkTypesData();
		await this.fetchMarkersData();
		await this.fetchCenterData();
	}

	async addMarker(ll: any) {
		this.markerValues.push({
			latLng: [ll.lat, ll.lng],
			mrk: null,
			selected: false,
			color: 'green',
			dbFields: {
				id: Date.now().toString(),
				name: 'unbekannt',
				nkType: 'unbekannt',
				comment: '',
				image: null,
				lastCleaned: null,
				createdAt: new Date(),
				changedAt: null
			}
		});
	}

	async deleteMarker(index: number) {
		if (index == -1) return;
		const id = this.markerValues[index].dbFields.id;
		this.markerValues.splice(index, 1);
		if (this.idb) {
			await this.idb!.delete('nk', id);
		} else {
			localStorage.removeItem(id);
		}
	}

	async updDefaultCenter(center: number[]) {
		// this.defaultCenter = center; //  does not trigger state change!?
		this.defaultCenter = center;
		const js = JSON.stringify(this.defaultCenter);
		console.log('upd js', js, 'center', center, 'dc', this.defaultCenter);
		if (this.idb) {
			await this.idb.put('settings', js, 'center');
		} else {
			localStorage.setItem('_center', js);
		}
	}

	async persist(mv: MarkerEntry, updateObject: Partial<UpdatableMarkerFields>) {
		for (const key of Object.keys(updateObject)) {
			if (key == 'latLng') mv.latLng = updateObject.latLng!;
			if (key == 'name') mv.dbFields.name = updateObject.name!;
			if (key == 'nkType') mv.dbFields.nkType = updateObject.nkType!;
			if (key == 'comment') mv.dbFields.comment = updateObject.comment!;
		}
		mv.dbFields.changedAt = new Date();
		const js = JSON.stringify(mv, (k, v) => {
			if (k == 'mrk') return undefined;
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

	async updNkTypes(nkType: string) {
		if (!nkType) return;
		let count = this.nkTypes.get(nkType);
		if (count) {
			this.nkTypes.set(nkType, count + 1);
		} else {
			this.nkTypes.set(nkType, 1);
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
