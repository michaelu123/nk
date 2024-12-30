import { getContext, setContext } from 'svelte';
import { markerVals } from './fakeDB';
import type { IDBPDatabase } from 'idb';

export interface MarkerProps {
	id: string;
	name: string;
	kind: string;
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
	kind: string;
	comment: string;
};

export interface User {
	id: string;
	username: string;
}

export interface StateProps {
	user: User | null;
	idb: IDBPDatabase | null;
}

let mucLat = 48.137236594542834,
	mucLng = 11.576174072626772;

export class State implements StateProps {
	user = $state<User | null>(null);
	idb = $state<IDBPDatabase | null>(null);

	defaultCenter = $state([mucLat, mucLng]);
	markerValues = $state<MarkerEntry[]>([]);
	maxBounds = $state([
		[48.21736966757146, 11.411914216629935],
		[48.0478968379877, 11.702028367388204]
	]);

	constructor(data: StateProps) {
		console.log('State constructor');
		this.updateState(data);
	}

	updateState(data: StateProps) {
		this.user = data.user;
		this.idb = data.idb;
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

	async fetchUserData() {
		let keys = this.idb
			? (await this.idb!.getAllKeys('nk')).map((k) => k.toString())
			: this.getLocalStorageKeys();
		let oneSeen = false;
		for (let key of keys) {
			if (key.toString() == 'one') oneSeen = true;
		}
		if (!oneSeen) {
			for (let mv of markerVals) {
				const js = JSON.stringify(mv, (k, v) => {
					if (k == 'mrk') return undefined;
					return v;
				});
				console.log('store test js', js);
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
			console.log('key', key, 'val', val);
			const mv = JSON.parse(val) as MarkerEntry;
			this.markerValues.push(mv);
		}
		console.log('mv length', this.markerValues.length);
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
				kind: 'unbekannt',
				comment: '',
				image: null,
				lastCleaned: null,
				createdAt: new Date(),
				changedAt: null
			}
		});
		console.log('state addMarker');
	}

	async deleteMarker(index: number) {
		console.log('statedm', index);
		if (index == -1) return;
		const id = this.markerValues[index].dbFields.id;
		this.markerValues.splice(index, 1);
		if (this.idb) {
			await this.idb!.delete('nk', id);
		} else {
			localStorage.removeItem(id);
		}
	}

	updCenter(center: number[]) {
		console.log('updCenter', center);
		// this.defaultCenter = center; //  does not trigger state change!?
		this.defaultCenter[0] = center[0];
		this.defaultCenter[1] = center[1];
		// update DB
	}

	async persist(mv: MarkerEntry, updateObject: Partial<UpdatableMarkerFields>) {
		for (const key of Object.keys(updateObject)) {
			console.log('key', key);
			if (key == 'latLng') mv.latLng = updateObject.latLng!;
			if (key == 'name') mv.dbFields.name = updateObject.name!;
			if (key == 'kind') mv.dbFields.kind = updateObject.kind!;
			if (key == 'comment') mv.dbFields.comment = updateObject.comment!;
		}
		mv.dbFields.changedAt = new Date();
		const js = JSON.stringify(mv, (k, v) => {
			if (k == 'mrk') return undefined;
			return v;
		});
		console.log('js', js);
		if (this.idb) {
			await this.idb.put('nk', js, mv.dbFields.id);
		} else {
			localStorage.setItem(mv.dbFields.id, js);
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
