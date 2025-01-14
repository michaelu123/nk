# NK

This project aims to develop a Webapp/PWA to monitor nesting boxes (Nistkästen, NK).
It shall display locations of NKs on a map. You can add NKs, edit details of an NK (like name, type or comments), add photos,
and add records, whenever the NK was visited to clean it. These records contain e.g. the date, what type of nest was found within, and more comments and photos.

In order to avoid the hassle of producing "real" apps for Android or IOS, the app should work as an installable webapp. It shall also work "in the field" without network connection. Before going out, all data shall be synced from the server to the app. Then the data is modified locally. On returning, the app is synced to the server.

These packages are used:

- Sveltekit as the main framework
- Drizzle as ORM for Mysql (or Postgres)
- Tailwindcss
- svelte-5-ui-lib for the UI
- Sveaflet for the map and markers
- idb for IndexedDB
- taking photos is derived from https://www.npmjs.com/package/@cloudparker/easy-camera-svelte and @types/w3c-image-capture
- for the File and Directory Entries API @types/filesystem

The intent is to store all data and photos first on the device, and sync it only on demand to/from the server.
Data is stored locally via navigator.storageBuckets, IndexedDB/idb or localstorage, depending on browser support.
Photos are stored locally with the File and Directory Entries API
( https://developer.mozilla.org/en-US/docs/Web/API/File_and_Directory_Entries_API )  
not to be confused with the Filesystem API ( https://developer.mozilla.org/en-US/docs/Web/API/File_System_API ).

For special Svelte5 code look out for {#key} and {#await}.
