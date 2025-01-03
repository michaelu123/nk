import type { MarkerEntry } from './state.svelte';

const mucLat = 48.137236594542834,
	mucLng = 11.576174072626772;

export let markerVals: MarkerEntry[] = [
	{
		latLng: [mucLat + 0.001, mucLng + 0.001],
		mrk: null,
		ctrls: null,
		selected: false,
		dbFields: {
			id: 'one',
			name: 'one',
			nkType: 'FK',
			comment: 'comment1',
			image: null,
			lastCleaned: new Date(2022, 1, 1, 12),
			createdAt: new Date(2022, 1, 1, 12),
			changedAt: null
		},
		color: 'green'
	},
	{
		latLng: [mucLat - 0.001, mucLng + 0.001],
		mrk: null,
		ctrls: null,
		selected: false,
		dbFields: {
			id: 'two',
			name: 'two',
			nkType: 'HK',
			comment: 'comment2',
			image: null,
			lastCleaned: new Date(2022, 1, 2, 12),
			createdAt: new Date(2022, 1, 2, 12),
			changedAt: null
		},
		color: 'red'
	},
	{
		latLng: [mucLat + 0.001, mucLng - 0.001],
		mrk: null,
		ctrls: null,
		selected: false,
		dbFields: {
			id: 'three',
			name: 'three',
			nkType: 'BK',
			comment: 'comment3',
			image: null,
			lastCleaned: new Date(2022, 1, 3, 12),
			createdAt: new Date(2022, 1, 3, 12),
			changedAt: null
		},
		color: 'green'
	},
	{
		latLng: [mucLat - 0.001, mucLng - 0.001],
		mrk: null,
		ctrls: null,
		selected: false,
		dbFields: {
			id: 'four',
			name: 'four',
			nkType: 'XK',
			comment: 'comment4',
			image: null,
			lastCleaned: new Date(2022, 1, 4, 12),
			createdAt: new Date(2022, 1, 4, 12),
			changedAt: null
		},
		color: 'red'
	}
];

export let nkDefaultTypes = [
	'Flachkasten',
	'Holzkasten',
	'Holzbetonkasten',
	'FL-Winterkasten',
	'FL-0',
	'FL-1',
	'FL-2',
	'FL-3',
	'FL-4',
	'FL-5',
	'FL-6',
	'FL-7',
	'FL-8',
	'FL-9',
	'FL-10',
	'FL-11',
	'FL-12',
	'FL-13',
	'FL-14',
	'FL-15',
	'FL-16',
	'FL-17',
	'FL-18',
	'FL-19'
];
