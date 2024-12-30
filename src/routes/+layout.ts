import type { LayoutLoad } from './$types';
import { browser } from '$app/environment';
import { openDB, type IDBPDatabase, wrap } from 'idb';
import { redirect } from '@sveltejs/kit';

export const load: LayoutLoad = async ({ data, url }) => {
	console.log('+layout.ts', browser, url);
	const { user } = data;
	if (browser) {
		if (navigator.hasOwnProperty('storageBuckets')) {
			const bucket = await (navigator as any).storageBuckets.open('nkbucket', {
				durability: 'strict', // Or `'relaxed'`.
				persisted: true // Or `false`.
			});

			if (await bucket.persisted()) {
				const idbUnwrapped: IDBRequest<IDBPDatabase<unknown> | null> = await new Promise(
					(resolve, reject) => {
						const request = bucket.indexedDB.open('NK');
						request.onupgradeneeded = async (ev: any) => {
							const db = ev.target.result;
							await db.createObjectStore('settings');
							await db.createObjectStore('nk');
						};
						request.onsuccess = () => resolve(request.result);
						request.onerror = () => reject(request.error);
					}
				);
				const idb: IDBPDatabase | null = await wrap(idbUnwrapped);
				return { idb, user };
			} else {
				console.log('DB not persisted, use localstorage');
			}
		} else {
			let idb: IDBPDatabase | null = await openDB('NK', 1, {
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
					// if (url.pathname != '/notpersistent') redirect(302, '/notpersistent');
					// use localStorage...
					idb = null;
				}
				const persisted = await navigator.storage.persisted();
				if (persisted) {
					console.log('Storage will not be cleared except by explicit user action');
				} else {
					console.log('Storage may be cleared by the UA under storage pressure.');
				}
			}

			return { idb, user };
		}
	}
	return { idb: null, user };
};
