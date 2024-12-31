# NK

This project aims to develop a Webapp/PWA to monitor nesting boxes (Nistkästen, NK).
It shall display locations of NKs on a map. You can add NKs, edit details of an NK (like name, type or comments), add one or more photos,
amd add records, whenever the NK was visited to clean it. These records contain e.g. the date, what type of nest was found within, and more comments and photos.

In order to avoid the hassle of producing "real" apps for Android or IOS, the app should work as an installable webapp. It shall also work "in the field" without network connection. Before going out, all data shall be synced from the server to the app. Then the data is modified locally. On returning, the app is synced to the server.

These packages are used:

- Sveltekit as the main framework
- Drizzle as ORM for Mysql (or Postgres)
- Tailwindcss
- svelte-5-ui-lib for the UI
- Sveaflet for the map and markers (Issue https://github.com/GrayFrost/sveaflet/issues/22)
- idb for IndexedDB

Data is stored via navigator.storageBuckets, IndexedDB/idb or localstorage, depending on browser support.

# SV

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
