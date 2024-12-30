import type { LayoutLoad } from './$types';
import { browser } from '$app/environment';
import { openDB } from 'idb';
import { redirect } from '@sveltejs/kit';

export const load: LayoutLoad = async ({ data, url }) => {
	console.log('+layout.ts', browser, url);
	const { user } = data;
	if (browser) {
		const idb = await openDB('NK', 1, {
			upgrade(db) {
				db.createObjectStore('settings');
				db.createObjectStore('nk');
			}
		});

		let persistent = false;
		if (navigator.storage && navigator.storage.persist) {
			const persistent = await navigator.storage.persist();
			if (persistent) {
				console.log('Dauerhafte Speicherung gewährt');
			} else {
				console.log('Dauerhafte Speicherung nicht gewährt');
				if (url.pathname != '/notpersistent') redirect(302, '/notpersistent');
			}
			const persisted = await navigator.storage.persisted();
			if (persisted) {
				console.log('Storage will not be cleared except by explicit user action');
			} else {
				console.log('Storage may be cleared by the UA under storage pressure.');
			}
		}
		return { idb, user };
	} else {
		return { idb: null, user };
	}
};
