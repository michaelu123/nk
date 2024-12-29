import { getContext, setContext } from 'svelte';
import { markerVals } from './fakeDB';

export interface MarkerProps {
	id: string;
	name: string;
	kind: string;
	comment: string;
	image: string | null;
	lastCleaned: Date | null;
}

export interface MarkerEntry {
	latLng: number[];
	mrk: any | null;
	fct: any | null;
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
}

export class State implements StateProps {
	user = $state<User | null>(null);

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
		this.fetchUserData();
	}

	async fetchUserData() {
		console.log('fetch', markerVals[0]);
		this.markerValues = markerVals;
	}

	async addMarker(ll: any) {
		this.markerValues.push({
			latLng: [ll.lat, ll.lng],
			mrk: null,
			fct: null,
			selected: false,
			color: 'green',
			dbFields: {
				id: Date.now().toString(),
				name: 'unbekannt',
				kind: 'unbekannt',
				comment: '',
				image: null,
				lastCleaned: null
			}
		});
		console.log('state addMarker');
	}

	async deleteMarker(index: number) {
		console.log('statedm', index);
		if (index == -1) return;
		this.markerValues.splice(index, 1);
	}

	async persist(index: number, updateObject: Partial<UpdatableMarkerFields>) {
		const mv = this.markerValues[index];
		for (const key of Object.keys(updateObject)) {
			console.log('key', key);
			if (key == 'latLng') mv.latLng = updateObject.latLng!;
			if (key == 'name') mv.dbFields.name = updateObject.name!;
			if (key == 'kind') mv.dbFields.kind = updateObject.kind!;
			if (key == 'comment') mv.dbFields.comment = updateObject.comment!;
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
