<script lang="ts">
	import { Sidebar, SidebarGroup, SidebarItem, SidebarButton, uiHelpers } from 'svelte-5-ui-lib';
	import { page } from '$app/stores';
	import { getState } from '$lib/state.svelte';

	let nkState = getState();
	let { markerValues, maxBounds, defaultCenter } = $derived(nkState);
	let activeUrl = $state($page.url.pathname);
	const spanClass = 'flex-1 ms-3 whitespace-nowrap';
	const sidebarUi = uiHelpers();
	let isSidebarOpen = $state(true);
	const closeSidebar = sidebarUi.close;
	$effect(() => {
		isSidebarOpen = sidebarUi.isOpen;
		activeUrl = $page.url.pathname;
	});

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

	let map: any = $state(null);
	let centering = $state(false);

	let selectedMarkerIndex = -1;
	let mucLat = 48.137236594542834,
		mucLng = 11.576174072626772;
	let currPos = $state([mucLat, mucLng]);
	let radius = $state(100);
	// let posTime = $state(Date.now()); // TODO weg
	// let nowTime = $state(Date.now());
	let defaultZoom = 15;

	// window.setInterval(() => (nowTime = Date.now()), 1000);

	const commonIconOptions = {
		iconSize: [40, 40], // size of the icon
		iconAnchor: [20, 40], // point of the icon which will correspond to marker's location
		popupAnchor: [0, -30] // point from which the popup should open relative to the iconAnchor
	};

	import redMarker from '$lib/assets/redMarker.svg';
	const redMarkerOptions = {
		...commonIconOptions,
		iconUrl: redMarker
	};

	import greenMarker from '$lib/assets/greenMarker.svg';
	const greenMarkerOptions = {
		...commonIconOptions,
		iconUrl: greenMarker
	};

	import selectedMarker from '$lib/assets/yellowMarker.svg';
	import { goto } from '$app/navigation';
	import { onMount, untrack } from 'svelte';
	const selectedMarkerOptions = {
		...commonIconOptions,
		iconUrl: selectedMarker
	};

	$effect(() => {
		if (map) {
			map.on('click', onMapClick);
			// map.on('move', onMapMove);
			// map.setMaxZoom(16);
			// map.setMinZoom(14);
			posStart();
		}
	});

	$effect(() => {
		// console.log('effect markers');
		markers();
	});

	const fctMap = new Map<string, any>();

	function markers() {
		for (const [index, mv] of markerValues.entries()) {
			// console.log('setfct1', mv.dbFields.name, mv.mrk);
			if (mv.mrk) {
				const newfct = (e: any) => mclick(index, e);
				const oldfct = fctMap.get(mv.dbFields.id);
				// console.log('setfct2', oldfct, newfct);
				if (oldfct) {
					mv.mrk.off('click', oldfct);
				}
				// mv.mrk.clearAllEventListeners(); or mv.mrk.off() does not have the same effect!?
				mv.mrk.on('click', newfct);
				fctMap.set(mv.dbFields.id, newfct);
			}
		}
	}

	function toggleDL() {
		document.documentElement.classList.toggle('dark');
	}

	function mclick(index: number, e: any) {
		// console.log(
		// 	'mc1',
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
			const mv = markerValues[selectedMarkerIndex];
			nkState.persist(mv, { latLng: mv.latLng });
		}
		if (selectedMarkerIndex == -1) {
			const mv = markerValues[index];
			mv.selected = true;
			selectedMarkerIndex = index;
		} else if (index == selectedMarkerIndex) {
			const mv = markerValues[index];
			mv.selected = false;
			selectedMarkerIndex = -1;
		} else {
			let mv = markerValues[selectedMarkerIndex];
			mv.selected = false;
			mv = markerValues[index];
			mv.selected = true;
			selectedMarkerIndex = index;
		}
		// console.log(
		// 	'mc2',
		// 	'index',
		// 	selectedMarkerIndex,
		// 	'centering',
		// 	centering,
		// 	'selected',
		// 	markerValues[index].selected
		// );

		// center = map.getCenter(); // to reposition
	}

	function onMapClick(e: any) {
		console.log('omc', selectedMarkerIndex);
		if (selectedMarkerIndex != -1) {
			const mv = markerValues[selectedMarkerIndex];
			mv.selected = false;
			selectedMarkerIndex = -1;
		}
	}

	function onMapMove(e: any) {
		const center = map.getCenter();
		markerValues[selectedMarkerIndex].latLng = center;
		// console.log('omm');
	}

	function logmap() {
		console.log('zoom', map.getZoom());
		console.log('center', map.getCenter());
	}

	function moveMarker() {
		console.log('mm1', selectedMarkerIndex, centering);
		if (selectedMarkerIndex == -1) return;
		console.log('centering', centering);
		map.on('move', onMapMove);
		centering = true;
		onMapMove(null);
		console.log('mm2', selectedMarkerIndex, centering);
	}

	function toggleMarker() {
		console.log('to1', selectedMarkerIndex, centering);
		if (selectedMarkerIndex == -1) return;
		const mv = markerValues[selectedMarkerIndex];
		selectedMarkerIndex = -1;
		mv.selected = false;
		mv.color = mv.color == 'red' ? 'green' : 'red';
		console.log('to2', selectedMarkerIndex, centering);
	}

	function addMarker() {
		const id = nkState.addMarker(map.getCenter());
		goto('/nk/' + id);
	}
	function editMarker() {
		if (selectedMarkerIndex == -1) return;
		const index = selectedMarkerIndex;
		const mv = markerValues[selectedMarkerIndex];
		selectedMarkerIndex = -1;
		mv.selected = false;
		goto('/nk/' + mv.dbFields.id);
	}

	function deleteMarker() {
		console.log('deleteMarker', selectedMarkerIndex);
		if (selectedMarkerIndex == -1) return;
		nkState.deleteMarker(selectedMarkerIndex);
		selectedMarkerIndex = -1;
	}

	function centerMap(pos: number[]) {
		console.log('centerMap', pos, 'dc', defaultCenter);
		map.flyTo(pos, map.getZoom());
		isSidebarOpen = false;
	}

	function updDefaultCenter() {
		nkState.updDefaultCenter(map.getCenter());
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
		console.log('locid', locid);
	}

	function posStart() {
		if ('geolocation' in navigator) {
			geoloc = true;
			console.log('geolocation is available');
			posRestart();
		} else {
			geoloc = false;
			console.log('geolocation is available');
		}
	}

	function posNow() {
		console.log('posNow');
		navigator.geolocation.getCurrentPosition(posSucc, posErr);
		for (let mv of markerValues) {
			console.log('mv1', mv);
		}
	}
</script>

{#snippet header()}
	<div class="sticky top-0 flex h-14 justify-start gap-4 bg-slate-100 p-2">
		<SidebarButton onclick={sidebarUi.toggle} class="mb-2" breakpoint="md" />
		<div class="w-full"></div>
		<Button outline pill onclick={logmap}>?</Button>
		<Button outline pill onclick={addMarker}>+</Button>
		<Button outline pill onclick={() => centerMap(currPos)}>{'\u2316'}</Button>
		<Button outline pill onclick={posNow}>{'>'}</Button>
		<!--Button outline pill onclick={toggleDL}>{'\u263E\u263C'}</Button-->
	</div>
{/snippet}

{#snippet svmap()}
	<div style="width:100%;height:80vh;">
		{#key defaultCenter}
			<SVMap
				bind:instance={map}
				options={{
					center: defaultCenter,
					zoom: defaultZoom,
					maxZoom: 20,
					minZoom: 10,
					zoomControl: false,
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
					<Marker latLng={mv.latLng} bind:instance={mv.mrk} {index}>
						{#key mv.selected}
							<Icon
								options={mv.selected
									? selectedMarkerOptions
									: mv.color == 'red'
										? redMarkerOptions
										: greenMarkerOptions}
							/>
							<Popup class="flex w-28 flex-col items-center">
								{mv.dbFields.name}
								{#if mv.selected}
									<Button class="btn m-1 w-24 bg-red-400" onclick={moveMarker}>Verschieben</Button>
									<Button class="btn m-1 w-24 bg-red-400" onclick={editMarker}>Details</Button>
									<Button class="btn m-1 w-24 bg-red-400" onclick={deleteMarker}>Löschen</Button>
									<Button class="btn m-1 w-24 bg-red-400" onclick={toggleMarker}>Kontrolle</Button>
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
			<SidebarItem label="Neues Zentrum" onclick={updDefaultCenter}></SidebarItem>
			<SidebarItem label="Zum Zentrum" onclick={() => centerMap(defaultCenter)}></SidebarItem>
			<SidebarItem label="Nabu-Import" href="/nabuimport"></SidebarItem>
			<SidebarItem label="Inbox" {spanClass} href="/"></SidebarItem>
			<SidebarItem label="Sidebar" href="/components/sidebar"></SidebarItem>
		</SidebarGroup>
		<SidebarGroup border={true}>
			<SidebarItem label="Dashboard" href="/"></SidebarItem>
			<SidebarItem label="Kanban" {spanClass} href="/"></SidebarItem>
			<SidebarItem label="Inbox" {spanClass} href="/"></SidebarItem>
			<SidebarItem label="Sidebar" href="/components/sidebar"></SidebarItem>
		</SidebarGroup>
	</Sidebar>
{/snippet}

{@render header()}
<div class="relative">
	{@render sidebar()}
	{@render svmap()}
</div>

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
