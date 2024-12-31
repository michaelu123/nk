import type { LayoutLoad } from './$types';
import { browser } from '$app/environment';
import { openDB, type IDBPDatabase, wrap } from 'idb';
import { redirect } from '@sveltejs/kit';

export const load: LayoutLoad = async ({ data, url }) => {
	console.log('+layout.ts', browser, url);
	const { user } = data;
	console.log('1load');
	if (browser) {
		if ('storageBuckets' in navigator) {
			// https://developer.chrome.com/blog/maximum-idb-performance-with-storage-buckets?hl=de
			// https://lists.w3.org/Archives/Public/www-archive/2020Nov/att-0000/TPAC_2020_Storage_Buckets_API.pdf
			// https://wicg.github.io/storage-buckets/explainer.html
			console.log('using storageBuckets API');
			// the reference to bucket must NOT go away. Otherwise it seems to get garbage collected,
			// and idb operations fail or don't return. Ultimately we save it in the State as context.
			// any below: cannot find any storagebucket types. navigator.storagebuckets does not compile.
			const bucket = await (navigator as any).storageBuckets.open('nkbucket', {
				durability: 'strict', // Or `'relaxed'`.
				persisted: true // Or `false`.
			});

			if (await bucket.persisted()) {
				console.log('storageBucket is persisted');
				const idbUnwrapped: IDBRequest<IDBPDatabase<unknown> | null> = await new Promise(
					(resolve, reject) => {
						const request = bucket.indexedDB.open('NK');
						request.onupgradeneeded = (ev: any) => {
							const db = ev.target.result;
							db.createObjectStore('settings');
							db.createObjectStore('nk');
						};
						request.onsuccess = () => resolve(request.result);
						request.onerror = () => reject(request.error);
					}
				);
				const idb: IDBPDatabase | null = await wrap(idbUnwrapped);
				console.log('5load', idb);
				return { bucket, idb, user };
			} else {
				console.log('storageBucket not persisted, use localstorage');
			}
		}

		if (navigator.storage && navigator.storage.persist) {
			const persistent = await navigator.storage.persist();
			if (persistent) {
				console.log('6load');
				let idb: IDBPDatabase | null = await openDB('NK', 1, {
					upgrade(db) {
						db.createObjectStore('settings');
						db.createObjectStore('nk');
					}
				});
				console.log('localStorage is persistent');
				const persisted = await navigator.storage.persisted();
				if (persisted) {
					console.log('Storage will not be cleared except by explicit user action');
				} else {
					console.log('Storage may be cleared by the UA under storage pressure.');
				}
				return { idb, user, bucket: null };
			} else {
				console.log('localStorage is not persistent, use ');
				// if (url.pathname != '/notpersistent') redirect(302, '/notpersistent');
				// use localStorage...
			}
		}
	}
	return { idb: null, bucket: null, user };
};
