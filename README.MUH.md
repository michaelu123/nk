http://localhost:5173/login
login muh xxx123

chrome://flags/#unsafely-treat-insecure-origin-as-secure

C:\Users\Michael\SvelteProjects\nk\node_modules\@sveltejs\kit\src\runtime\server\cookie.js MUH change

vite.config.ts: server: { host: '0.0.0.0', port: 5173 }

npm install leaflet --legacy-peer-deps

C:\tools> ngrok http --url=shiner-meet-termite.ngrok-free.app 5173

chrome://settings/content/siteData

vite-imagetools?

There is little documentation to be found on storagebuckets as of end of 2024. Perhaps this code helps someone to avoid the pitfalls I ran into.

The following code tries to open storagebuckets with indexeddb first, then just indexeddb. If this fails too, you must use localStorage. The indexeddb is wrapped with idb.

```
import { browser } from '$app/environment';
import { openDB, type IDBPDatabase, wrap } from 'idb';
if (browser) {
	if ('storageBuckets' in navigator) {
		console.log('using StorageBuckets API');
		// the reference to bucket must NOT go away. Otherwise it seems to get garbage collected,
		// and idb operations fail or don't return. Ultimately we save it in the State as context.
		// any below: cannot find any storagebucket types. navigator.storagebuckets does not compile.
		const bucket = await(navigator as any).storageBuckets.open('nkbucket', {
			durability: 'strict', // Or `'relaxed'`.
			persisted: true // Or `false`.
		});

		if (await bucket.persisted()) {
			console.log('StorageBuckets is persisted');
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
			return { bucket, idb };
		} else {
			console.log('StorageBuckets not persisted, try IndexedDb');
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
			console.log('IndexedDb is persistent');
			const persisted = await navigator.storage.persisted();
			if (persisted) {
				console.log('Storage will not be cleared except by explicit user action');
			} else {
				console.log('Storage may be cleared by the UA under storage pressure.');
			}
			return { idb, bucket: null };
		} else {
			console.log('IndexedDb is not persistent, must use Localstorage');
			// use localStorage...
		}
	}
}
return { idb: null, bucket: null };
```

Note the warning to not drop the bucket reference, otherwise the garbage collector deletes the bucket from under the indexeddb.
