import type { MarkerEntry } from './state.svelte';

const mucLat = 48.137236594542834,
	mucLng = 11.576174072626772;

export let markerVals: MarkerEntry[] = [
	{
		latLng: [mucLat + 0.001, mucLng + 0.001],
		mrk: null,
		selected: false,
		dbFields: {
			id: 'one',
			name: 'one',
			kind: 'FK',
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
		selected: false,
		dbFields: {
			id: 'two',
			name: 'two',
			kind: 'HK',
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
		selected: false,
		dbFields: {
			id: 'three',
			name: 'three',
			kind: 'BK',
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
		selected: false,
		dbFields: {
			id: 'four',
			name: 'four',
			kind: 'XK',
			comment: 'comment4',
			image: null,
			lastCleaned: new Date(2022, 1, 4, 12),
			createdAt: new Date(2022, 1, 4, 12),
			changedAt: null
		},
		color: 'red'
	}
];
