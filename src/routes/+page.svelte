<script lang="ts">
	import { Sidebar, SidebarGroup, SidebarItem, SidebarButton, uiHelpers } from 'svelte-5-ui-lib';
	import { page } from '$app/stores';
	import { getState } from '$lib/state.svelte';
	import { goto } from '$app/navigation';

	let nkState = getState();
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
	let followingGPS = $state(false);
	let isGPSon = $state(false);
	// let posTime = $state(Date.now()); // TODO weg
	// let nowTime = $state(Date.now());

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
	const selectedMarkerOptions = {
		...commonIconOptions,
		iconUrl: selectedMarker
	};

	let timeoutId: number = -1;
	$effect(() => {
		if (map) {
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
			// posStart(); // start watchPosition from user gesture!
			timeoutId = window.setTimeout(markers, 100);
		}
	});

	// Cannot get this to work... with dependencies on markerValues  this effect is called a million times.
	// It should be called only on changes of isLoading, but either it is called far too often,
	// when markers() is not called from untrack, or not at all, when isLoading changes to false.

	// $effect(() => {
	// 	$inspect.trace('e3');
	// 	console.log('3effect', isLoading);
	// 	untrack(markers);
	// });

	const fctMap = new Map<string, any>();

	// I need to set the markers.on() functions, after a) the markers were all loaded from the store,
	// and b) the map has done the bind:instance to mv.mrk for all Sveaflet Markers.
	// I don't know how else I can get access to the leaflet marker underlying the sveaflet Marker.

	// Another problem: if I use setInterval, a clearInterval call instead of the clearTimeout does not work...
	// Therefore a setTimeout sequence. Same for set/clearInterval without window. in front, seemingly a NodeJS.set/clearInterval.
	function markers() {
		if (isLoading) {
			window.clearTimeout(timeoutId);
			timeoutId = window.setTimeout(markers, 100);
			return;
		}
		for (const mv of markerValues) {
			if (!mv.mrk) {
				window.clearTimeout(timeoutId);
				timeoutId = window.setTimeout(markers, 100);
				return;
			}
		}
		window.clearTimeout(timeoutId);
		for (const [index, mv] of markerValues.entries()) {
			if (mv.mrk) {
				const newfct = (e: any) => mclick(index, e);
				const oldfct = fctMap.get(mv.id);
				if (oldfct) {
					mv.mrk.off('click', oldfct);
				}
				// mv.mrk.clearAllEventListeners(); or mv.mrk.off() does not have the same effect!?
				mv.mrk.on('click', newfct);
				fctMap.set(mv.id, newfct);
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
			nkState.persistNK(mv, { latLng: mv.latLng });
			// somehow mv.mrk lost the onclick function!?!?
			if (mv.mrk) {
				const oldfct = fctMap.get(mv.id);
				if (oldfct) {
					mv.mrk.off('click', oldfct);
					mv.mrk.on('click', oldfct);
				}
			}
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
				// somehow mv.mrk lost the onclick function!?!?
				if (mv.mrk) {
					const oldfct = fctMap.get(mv.id);
					if (oldfct) {
						mv.mrk.off('click', oldfct);
						mv.mrk.on('click', oldfct);
					}
				}
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
		const id = await nkState.addMarker(map.getCenter());
		await gotoID(id + '?change', 'nk');
	}

	function editMarker() {
		if (selectedMarkerIndex == -1) return;
		const index = selectedMarkerIndex;
		const mv = markerValues[selectedMarkerIndex];
		selectedMarkerIndex = -1;
		mv.selected = false;
		gotoID(mv.id, 'nk');
	}

	function deleteMarker() {
		if (selectedMarkerIndex == -1) return;
		nkState.deleteMarker(selectedMarkerIndex);
		selectedMarkerIndex = -1;
	}

	function centerMap(pos: number[]) {
		map.flyTo(pos, map.getZoom());
		isSidebarOpen = false;
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
</script>

{#snippet header()}
	<div class="sticky top-0 flex h-14 justify-start gap-4 bg-slate-100 p-2">
		<SidebarButton onclick={sidebarUi.toggle} class="mb-2" breakpoint="md" />
		<div class="w-full"></div>
		<Button outline pill onclick={logmap}>?</Button>
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
								{mv.name}
								{#if mv.selected}
									<Button class="btn m-1 w-24 bg-red-400" onclick={editMarker}>Details</Button>
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
			<SidebarItem label="Neues Zentrum" onclick={updDefaultCenter}></SidebarItem>
			<SidebarItem label="Zum Zentrum" onclick={() => centerMap(defaultCenter)}></SidebarItem>
			<SidebarItem label="Nabu-Import" href="/nabuimport"></SidebarItem>
			<SidebarItem label={isGPSon ? 'GPS aus' : 'GPS ein'} onclick={posStart}></SidebarItem>
			<SidebarItem label={followingGPS ? 'GPS nicht folgen' : 'GPS folgen'} onclick={followGPS}
			></SidebarItem>
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
