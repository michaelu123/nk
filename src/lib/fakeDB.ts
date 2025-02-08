/* 
import type { MarkerEntryProps } from './state.svelte';

const mucLat = 48.137236594542834,
	mucLng = 11.576174072626772;

export let nkVals: NkEntry[] = [
	{
		latLng: [mucLat + 0.001, mucLng + 0.001],
		ctrls: null,
		selected: false,
		id: 'one',
		name: 'one',
		nkType: 'FK',
		comment: 'comment1',
		image: null,
		lastCleaned: new Date(2022, 1, 1, 12),
		createdAt: new Date(2022, 1, 1, 12),
		changedAt: null,
		color: 'green',
		region: 'alle',
		deletedAt: null
	},
	{
		latLng: [mucLat - 0.001, mucLng + 0.001],
		ctrls: null,
		selected: false,
		id: 'two',
		name: 'two',
		nkType: 'HK',
		comment: 'comment2',
		image: null,
		lastCleaned: new Date(2022, 1, 2, 12),
		createdAt: new Date(2022, 1, 2, 12),
		changedAt: null,
		color: 'red',
		region: 'alle',
		deletedAt: null
	},
	{
		latLng: [mucLat + 0.001, mucLng - 0.001],
		ctrls: null,
		selected: false,
		id: 'three',
		name: 'three',
		nkType: 'BK',
		comment: 'comment3',
		image: null,
		lastCleaned: new Date(2022, 1, 3, 12),
		createdAt: new Date(2022, 1, 3, 12),
		changedAt: null,
		color: 'green',
		region: 'alle',
		deletedAt: null
	},
	{
		latLng: [mucLat - 0.001, mucLng - 0.001],
		ctrls: null,
		selected: false,
		id: 'four',
		name: 'four',
		nkType: 'XK',
		comment: 'comment4',
		image: null,
		lastCleaned: new Date(2022, 1, 4, 12),
		createdAt: new Date(2022, 1, 4, 12),
		changedAt: null,
		color: 'red',
		region: 'alle',
		deletedAt: null
	}
];
*/
export let nkDefaultTypes = [
	'Nistkasten',
	'Flachkasten',
	'Holzkasten',
	'Holzbetonkasten',
	'FL-Winterkasten',
	'FL-Sommerkasten'
];

export let nkDefaultSpecies = [
	'Kohlmeise',
	'Blaumeise',
	'Meise',
	'Spatz',
	'Kleiber',
	'Siebenschläfer',
	'Leer',
	'Maus',
	'Hornissen',
	'Wespen'
];
