<script lang="ts">
	import '../app.css';
	import { setState, State, type Region } from '$lib/state.svelte';
	let { children, data } = $props();
	let { user, idb, bucket, rootDir, regionsDB, regionIdb, selectedRegion, regionsIdb } = data;

	let regions: Region[] = [];
	let region: Region | null = null;
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
		regions = regionsIdb!;
	}

	selectedRegion = selectedRegion ?? null; // this ??null and the two more below are necessary because the compiler thinks they are undefined?
	if (selectedRegion) {
		region = regions.find((r) => r.shortName == selectedRegion) ?? null;
		if (region) {
			State.storeSettings(idb, 'selectedRegion', selectedRegion); // async !?
		}
	}

	setState({
		user: data.user ?? null,
		idb: data.idb,
		bucket: data.bucket,
		rootDir: data.rootDir ?? null,
		region,
		regions,
		selectedRegion
	});
</script>

<main>
	{@render children()}
</main>
