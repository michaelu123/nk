<script lang="ts">
	import {
		Sidebar,
		SidebarGroup,
		SidebarItem,
		SidebarButton,
		uiHelpers,
		Progressbar
	} from 'svelte-5-ui-lib';
	import { page } from '$app/stores';
	import { getState, MarkerEntry } from '$lib/state.svelte';
	import { goto } from '$app/navigation';

	import {
		Map as SVMap,
		TileLayer,
		Marker,
		Popup,
		Icon,
		ControlZoom,
		ControlAttribution,
		Polygon,
		Circle
	} from 'sveaflet';
	import { Button } from 'svelte-5-ui-lib';
	import { walkFS, rmFS } from '$lib/fs';

	import redMarker from '$lib/assets/redMarker.svg';
	import greenMarker from '$lib/assets/greenMarker.svg';
	import selectedMarker from '$lib/assets/yellowMarker.svg';
	import { Sync } from '$lib/sync.js';

	let nkState = getState();
	let { data } = $props();
	let { rootDir, fetch } = data;
	let { region } = $derived(nkState);

	let { markerValues, maxBounds, defaultCenter, defaultZoom, isLoading } = $derived(nkState);

	// sidebar stuff
	let activeUrl = $state($page.url.pathname);
	const spanClass = 'flex-1 ms-3 whitespace-nowrap';
	const sidebarUi = uiHelpers();
	let isSidebarOpen = $state(true);
	const closeSidebar = sidebarUi.close;
	$effect(() => {
		isSidebarOpen = sidebarUi.isOpen;
		activeUrl = $page.url.pathname;
	});

	let map: any = $state(null);
	let centering = $state(false);

	let selectedMarkerIndex = -1;
	// svelte-ignore state_referenced_locally
	nkState.region = region!;
	let currPos = $state(nkState.region.center);
	let radius = $state(100);
	let followingGPS = $state(false);
	let isGPSon = $state(false);
	let progress = $state(0);

	const commonIconOptions = {
		iconSize: [40, 40], // size of the icon
		iconAnchor: [20, 40], // point of the icon which will correspond to marker's location
		popupAnchor: [0, -30] // point from which the popup should open relative to the iconAnchor
	};

	const redMarkerOptions = {
		...commonIconOptions,
		iconUrl: redMarker
	};

	const greenMarkerOptions = {
		...commonIconOptions,
		iconUrl: greenMarker
	};

	const selectedMarkerOptions = {
		...commonIconOptions,
		iconUrl: selectedMarker
	};

	let timeoutId: number = -1;
	$effect(() => {
		if (map) {
			console.log('mapeffect');
			map.on('click', onMapClick);
			// map.on('move', onMapMove);
			// map.setMaxZoom(16);
			// map.setMinZoom(14);
			const scenter = sessionStorage.getItem('center');
			const szoom = sessionStorage.getItem('zoom');
			if (scenter && szoom) {
				const center = JSON.parse(scenter);
				const zoom = +szoom;
				const options = { animate: false };
				if (center && zoom) {
					map.flyTo(center, zoom, options);
				}
				sessionStorage.removeItem('center');
				sessionStorage.removeItem('zoom');
			}
		}
	});

	function toggleDL() {
		document.documentElement.classList.toggle('dark');
	}

	function mclick(mv: MarkerEntry, index: number, e: any) {
		// console.log(
		// 	'mc1',
		//  mv.name,
		// 	'index',
		// 	index,
		// 	'selindex',
		// 	selectedMarkerIndex,
		// 	'centering',
		// 	centering,
		// 	'selected',
		// 	markerValues[index].selected,
		// 	'event',
		// 	e
		// );

		if (centering) {
			map.off('move', onMapMove);
			centering = false;
			nkState.persistNK(mv, { latLng: mv.latLng });
		}
		if (selectedMarkerIndex == -1) {
			mv.selected = true;
			selectedMarkerIndex = index;
		} else if (index == selectedMarkerIndex) {
			mv.selected = false;
			selectedMarkerIndex = -1;
		} else {
			const othermv = markerValues[selectedMarkerIndex];
			othermv.selected = false;
			mv.selected = true;
			selectedMarkerIndex = index;
		}
		// console.log(
		// 	'mc2',
		//  mv.name,
		// 	'index',
		// 	selectedMarkerIndex,
		// 	'centering',
		// 	centering,
		// 	'selected',
		// 	markerValues[index].selected
		// );
	}

	function onMapClick(e: any) {
		if (selectedMarkerIndex != -1) {
			const mv = markerValues[selectedMarkerIndex];
			mv.selected = false;
			selectedMarkerIndex = -1;
			if (centering) {
				map.off('move', onMapMove);
				centering = false;
				nkState.persistNK(mv, { latLng: mv.latLng });
			}
		}
	}

	function onMapMove(e: any) {
		if (selectedMarkerIndex == -1) return;
		const center = map.getCenter();
		markerValues[selectedMarkerIndex].latLng = center;
	}

	function logmap() {
		console.log('zoom', map.getZoom());
		console.log('center', map.getCenter());
	}

	function moveMarker() {
		if (selectedMarkerIndex == -1) return;
		map.on('move', onMapMove);
		centering = true;
		onMapMove(null);
	}

	function addControlToMarker() {
		if (selectedMarkerIndex == -1) return;
		const mv = markerValues[selectedMarkerIndex];
		selectedMarkerIndex = -1;
		mv.selected = false;
		gotoID(mv.id, 'kontrolle');
	}

	async function gotoID(id: string, path: string) {
		sessionStorage.setItem('center', JSON.stringify(map.getCenter()));
		sessionStorage.setItem('zoom', map.getZoom());
		await goto(`/${path}/${id}`);
	}

	async function addMarker() {
		unselect();
		// const id = await nkState.addMarker(map.getCenter());
		// await gotoID(id + '?new', 'nk');
		const pos = map.getCenter();
		await goto('/nk/new?ll=' + pos.lat + ',' + pos.lng);
	}

	function unselect() {
		if (selectedMarkerIndex == -1) return;
		const mv = markerValues[selectedMarkerIndex];
		selectedMarkerIndex = -1;
		mv.selected = false;
	}

	function editMarker() {
		if (selectedMarkerIndex == -1) return;
		const index = selectedMarkerIndex;
		const mv = markerValues[selectedMarkerIndex];
		selectedMarkerIndex = -1;
		mv.selected = false;
		gotoID(mv.id, 'nk');
	}

	async function deleteMarker() {
		if (selectedMarkerIndex == -1) return;
		const mv = markerValues[selectedMarkerIndex];
		mv.selected = false;
		const confirmDelete = window.confirm(
			`Sie wollen die Daten des Nistkasten ${mv.name} wirklich löschen?`
		);
		if (confirmDelete) {
			await nkState.deleteMarker(selectedMarkerIndex);
			selectedMarkerIndex = -1;
		}
	}

	function centerMap(pos: number[]) {
		map.flyTo(pos, map.getZoom());
		isSidebarOpen = false;
		unselect();
	}

	function updDefaultCenter() {
		nkState.updDefaultCenter(map.getCenter(), map.getZoom());
		isSidebarOpen = false;
	}

	let locid = -1;
	let tid: NodeJS.Timeout | null = null;
	let geoloc = $state(false);

	function posSucc(pos: any) {
		const crd = pos.coords;
		currPos = [crd.latitude, crd.longitude];
		// posTime = pos.timestamp;
		radius = pos.coords.accuracy / 2;
		if (followingGPS) map.flyTo(currPos, map.getZoom());
	}

	function posErr(err: any) {
		console.log('Error', err);
		// posRestart();
	}

	function posRestart() {
		if (locid != -1) {
			navigator.geolocation.clearWatch(locid);
		}
		let options = {
			enableHighAccuracy: true,
			timeout: Infinity,
			maximumAge: 5000
		};
		locid = navigator.geolocation.watchPosition(posSucc, posErr, options);
	}

	function posStart() {
		if (isGPSon) {
			if (locid != -1) {
				navigator.geolocation.clearWatch(locid);
				locid = -1;
			}
			isGPSon = false;
		} else {
			if ('geolocation' in navigator) {
				geoloc = true;
				console.log('geolocation is available');
				posRestart();
			} else {
				geoloc = false;
				console.log('geolocation is not available');
			}
			isGPSon = true;
		}
		isSidebarOpen = false;
	}

	function followGPS() {
		followingGPS = !followingGPS;
		if (followingGPS) {
			map.flyTo(currPos, map.getZoom());
		}
		isSidebarOpen = false;
	}

	async function lsR() {
		try {
			await walkFS(rootDir!, '');
		} catch (e) {
			console.log('lsRe', e);
		}
		console.log('Ende ls-R');
		isSidebarOpen = false;
	}

	async function rmR() {
		try {
			await rmFS(rootDir!);
		} catch (e) {
			console.log('rmR', e);
		}
		console.log('Ende rm-R');
		isSidebarOpen = false;
	}

	// are milliseconds counted up by 1 or are there gaps?
	// function testclockres() {
	// 	const m = new Map<number, number>();
	// 	for (let i = 0; i < 100000; i++) {
	// 		const t = Date.now();
	// 		let e = m.get(t);
	// 		if (e) {
	// 			m.set(t, e + 1);
	// 		} else {
	// 			m.set(t, 1);
	// 		}
	// 	}
	// 	console.log('clockres', m);
	// }

	async function syncServer() {
		const sy = new Sync(nkState, fetch!, (p: number) => (progress = Math.round(p)));
		await sy.sync();
	}

	async function clearData() {
		await rmR();
		const sy = new Sync(nkState, fetch!, () => {});
		await sy.clearDb();
		await sy.removeDuplicates();
		console.log('Ende clearData');
		isSidebarOpen = false;
	}
</script>

{#snippet header()}
	<div
		class="absolute top-0 z-[500] flex h-16 w-11/12 items-center justify-start gap-4 bg-slate-100 p-2"
	>
		<SidebarButton onclick={sidebarUi.toggle} class="mb-2" breakpoint="md" />
		<div class="w-full"><p class="text-center">{region?.name}</p></div>
		{#if $page.url.hostname == 'localhost'}
			<Button outline pill onclick={logmap}>?</Button>
		{/if}
		<Button outline pill onclick={addMarker}>+</Button>
		<Button outline pill onclick={() => centerMap(currPos)}>{'\u2316'}</Button>
		<!--Button outline pill onclick={toggleDL}>{'\u263E\u263C'}</Button-->
	</div>
{/snippet}

{#snippet svmap()}
	<div style="width:100%;height:100vh;">
		{#key defaultCenter}
			<SVMap
				bind:instance={map}
				options={{
					center: defaultCenter,
					zoom: defaultZoom,
					maxZoom: 20,
					minZoom: 10,
					zoomControl: false, // switch off default control in the top left corner
					attributionControl: true,
					maxBounds
				}}
			>
				<p id="crosshair">{'\u2316'}</p>
				<Polygon
					latLngs={[
						[maxBounds[0][0], maxBounds[0][1]],
						[maxBounds[0][0], maxBounds[1][1]],
						[maxBounds[1][0], maxBounds[1][1]],
						[maxBounds[1][0], maxBounds[0][1]]
					]}
					options={{ fill: false }}
				/>
				<TileLayer
					url={'https://tile.openstreetmap.org/{z}/{x}/{y}.png'}
					attribution={'&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
					options={{
						maxNativeZoom: 19,
						maxZoom: 20
					}}
				></TileLayer>
				<ControlZoom options={{ position: 'topright' }} />
				<ControlAttribution
					options={{
						prefix:
							'&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
					}}
				/>
				{#key currPos}
					<Marker latLng={currPos}>
						<!-- <Popup class="w-20 text-center">
						Age: {Math.round((nowTime - posTime) / 1000)}
					</Popup> -->
					</Marker>
					<Circle latLng={currPos} options={{ radius, fillOpacity: 0.1 }} />
				{/key}
				{#each markerValues as mv, index (mv['latLng'])}
					<Marker latLng={mv.latLng} {index} onclick={(e: any) => mclick(mv, index, e)}>
						{#key mv.selected}
							<Icon
								options={mv.selected
									? selectedMarkerOptions
									: mv.color == 'red'
										? redMarkerOptions
										: greenMarkerOptions}
							/>
							<Popup class="flex w-28 flex-col items-center">
								{mv.name}
								{#if mv.selected}
									<Button class="btn m-1 w-24 bg-red-400" onclick={editMarker}>Anzeigen</Button>
									<Button class="btn m-1 w-24 bg-red-400" onclick={addControlToMarker}
										>Kontrolle</Button
									>
									<Button class="btn m-1 w-24 bg-red-400" onclick={moveMarker}>Verschieben</Button>
									<Button class="btn m-1 w-24 bg-red-400" onclick={deleteMarker}>Löschen</Button>
								{/if}
							</Popup>
						{/key}
					</Marker>
				{/each}
			</SVMap>
		{/key}
	</div>
{/snippet}

{#snippet sidebar()}
	<Sidebar
		backdrop={false}
		isOpen={isSidebarOpen}
		{closeSidebar}
		params={{ x: -50, duration: 500 }}
		class="z-[500]  h-full w-auto"
		position="absolute"
		activeClass="p-2"
		nonActiveClass="p-2"
		breakpoint="md"
	>
		<!-- <CloseButton
			onclick={closeSidebar}
			color="gray"
			class="absolute right-2 top-2 p-2 md:hidden"
		/> -->
		<SidebarGroup border={false}>
			<SidebarItem label="Revier" href="/region"></SidebarItem>
			<SidebarItem label="Neues Zentrum" onclick={updDefaultCenter}></SidebarItem>
			<SidebarItem label="Zum Zentrum" onclick={() => centerMap(defaultCenter)}></SidebarItem>
			<SidebarItem label={isGPSon ? 'GPS aus' : 'GPS ein'} onclick={posStart}></SidebarItem>
			<SidebarItem label={followingGPS ? 'GPS nicht folgen' : 'GPS folgen'} onclick={followGPS}
			></SidebarItem>
			<SidebarItem label="Daten sync" onclick={syncServer}></SidebarItem>
			{#if $page.url.hostname == 'localhost' || $page.url.searchParams.get('more')}
				<SidebarItem label="Nabu-Import" href="/nabuimport"></SidebarItem>
				<SidebarItem label="ls-R" onclick={lsR}></SidebarItem>
				<SidebarItem label="rm-R" onclick={rmR}></SidebarItem>
				<SidebarItem label="Alles löschen" onclick={clearData}></SidebarItem>
			{/if}
			<!--SidebarItem label="testcr" onclick={testclockres}></SidebarItem-->
		</SidebarGroup>
		<!-- <SidebarGroup border={true}>
			<SidebarItem label="Dashboard" href="/"></SidebarItem>
			<SidebarItem label="Kanban" {spanClass} href="/"></SidebarItem>
			<SidebarItem label="Inbox" {spanClass} href="/"></SidebarItem>
			<SidebarItem label="Sidebar" href="/components/sidebar"></SidebarItem>
		</SidebarGroup> -->
	</Sidebar>
{/snippet}

<div class="relative">
	{@render header()}
	{#if progress}
		<div class="absolute left-1/4 top-1/3 z-[490] w-2/4">
			<Progressbar {progress} labelOutside="Speicherfortschritt" size="h-6" />
		</div>
	{/if}
</div>
{@render sidebar()}
{#if isLoading}
	<p>Loading</p>
{:else}
	{@render svmap()}
{/if}

<style>
	#crosshair {
		/* some experimenting done... */
		left: calc(50% - 39px);
		top: calc(50% - 40px);
		position: absolute;
		width: 80px;
		height: 80px;
		z-index: 500;
		text-align: center;
		font-weight: normal;
		font-size: 50px;
		color: #222;
		text-shadow: 1px 1px 3px #fff;
		pointer-events: none;
	}
</style>
