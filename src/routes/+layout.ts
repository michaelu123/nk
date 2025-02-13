import type { LayoutLoad } from './$types';
import { browser } from '$app/environment';
import { openDB, type IDBPDatabase, wrap } from 'idb';
import { getDirectory, getfs } from '$lib/fs';
import { redirect } from '@sveltejs/kit';
import { State, type Region } from '$lib/state.svelte';
import { clearIDb } from '$lib/utils';

let useBucketsAnyways = true; // TODO configurable
let useIndexedDbAnyways = true; // TODO configurable

async function getStorage(): Promise<{ idb: any; bucket: any }> {
	if ('storageBuckets' in navigator) {
		// https://developer.chrome.com/blog/maximum-idb-performance-with-storage-buckets?hl=de
		// https://lists.w3.org/Archives/Public/www-archive/2020Nov/att-0000/TPAC_2020_Storage_Buckets_API.pdf
		// https://wicg.github.io/storage-buckets/explainer.html
		// the reference to bucket must NOT go away. Otherwise it seems to get garbage collected,
		// and idb operations fail or don't return. Ultimately we save it in the State as context.
		// any below: cannot find any storagebucket types. navigator.storagebuckets does not compile.
		const bucket = await (navigator as any).storageBuckets.open('nkbucket', {
			durability: 'strict', // Or `'relaxed'`.
			persisted: true // Or `false`.
		});
		let persisted = await bucket.persisted();
		if (persisted) {
			console.log('StorageBuckets is persisted');
		} else {
			console.log('StorageBuckets not persisted');
			if (useBucketsAnyways) {
				console.log('StorageBuckets used nevertheless');
				persisted = true;
			}
		}
		if (persisted) {
			const idbUnwrapped: IDBRequest<IDBPDatabase<unknown> | null> = await new Promise(
				(resolve, reject) => {
					const request = bucket.indexedDB.open('NK');
					request.onupgradeneeded = (ev: any) => {
						const db = ev.target.result;
						db.createObjectStore('settings');
						const dbnk = db.createObjectStore('nk');
						dbnk.createIndex('nkRegionIndex', 'region');
						const dbkn = db.createObjectStore('kontrollen');
						dbkn.createIndex('nkRegionIndex', 'region');
					};
					request.onsuccess = () => resolve(request.result);
					request.onerror = () => reject(request.error);
				}
			);
			const idb: IDBPDatabase | null = await wrap(idbUnwrapped);
			return { bucket, idb };
		} else {
			console.log('StorageBuckets not persisted and not used anyways, try IndexedDb');
		}
	}
	if (navigator.storage) {
		let persistent =
			navigator.storage && navigator.storage.persist && (await navigator.storage.persist());

		if (persistent) {
			console.log('IndexedDb is persistent');
		} else {
			console.log('IndexedDb not persistent');
			if (useIndexedDbAnyways) {
				console.log('IndexedDb used nevertheless');
				persistent = true;
			}
		}
		if (persistent) {
			let idb: IDBPDatabase | null = await openDB('NK', 1, {
				upgrade(db) {
					db.createObjectStore('settings');
					const dbnk = db.createObjectStore('nk');
					dbnk.createIndex('nkRegionIndex', 'region');
					const dbkn = db.createObjectStore('kontrollen');
					dbkn.createIndex('nkRegionIndex', 'region');
				}
			});
			console.log('Using IndexedDb');
			const persisted = await navigator.storage.persisted();
			if (persisted) {
				console.log('IndexedDb will not be cleared except by explicit user action');
			} else {
				console.log('IndexedDb may be cleared by the UA under storage pressure.');
			}
			return { idb, bucket: null };
		} else {
			console.log('IndexedDb is not persistent and not used anyways, must use LocalStorage...');
			// if (url.pathname != '/notpersistent') redirect(302, '/notpersistent');
		}
	}
	return { idb: null, bucket: null };
}

async function getRootDir(): Promise<FileSystemDirectoryEntry | null> {
	try {
		let fs = await getfs();
		console.log('test fs', fs);
		let dir = await getDirectory(fs, '/');
		console.log('test dir', dir);
		return dir;
	} catch (e) {
		console.log('FileSystem API not working!?', e);
	}
	return null;
}

export const load: LayoutLoad = async ({ data, url, fetch }) => {
	const { user, regionsDB } = data;
	if (browser) {
		let { idb, bucket } = await getStorage();

		const storedUser = idb
			? await idb.get('settings', 'username')
			: localStorage.getItem('_username');
		if (user && user.username != storedUser) {
			await clearIDb(idb, true);
			if (idb) {
				await idb.put('settings', user.username, 'username');
			} else {
				localStorage.setItem('_username', user.username);
			}
		}

		let regionsIdb: Region[] | null = idb
			? await idb.get('settings', 'regions')
			: (JSON.parse(localStorage.getItem('_regions') || '[]') as Region[]);

		if ((!regionsIdb || regionsIdb.length == 0) && regionsDB && regionsDB.length > 0) {
			regionsIdb = [];
			for (const rdb of regionsDB) {
				const obj: any = JSON.parse(rdb.data!);
				const ridb: Region = {
					name: rdb.regionname!,
					shortName: rdb.shortname!,
					lowerLeft: obj.lowerLeft,
					upperRight: obj.upperRight,
					center: obj.center
				};
				regionsIdb.push(ridb);
			}
			State.storeSettings(idb, 'regions', regionsIdb); // async !?
		} else {
		}

		let regionIdb: Region | null = null;
		let selectedRegion: string | null = null;
		let rootDir = await getRootDir();

		selectedRegion = idb
			? await idb.get('settings', 'selectedRegion')
			: localStorage.getItem('_selectedRegion');

		regionIdb = (regionsIdb || []).find((r) => r.shortName == selectedRegion) ?? null;

		if (!regionsIdb || regionsIdb.length == 0 || !selectedRegion) {
			if (url.pathname != '/region' && !url.pathname.startsWith('/log')) {
				return redirect(307, '/region');
			}
		}

		return { idb, bucket, user, rootDir, regionIdb, selectedRegion, regionsIdb, regionsDB, fetch };
	}
};
