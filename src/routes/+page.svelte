<script lang="ts">
	import {
		CloseButton,
		Sidebar,
		SidebarGroup,
		SidebarItem,
		SidebarButton,
		uiHelpers
	} from 'svelte-5-ui-lib';
	import { page } from '$app/stores';
	import { getState } from '$lib/state.svelte';

	let nkState = getState();
	let { markerValues, maxBounds } = nkState;
	$inspect('markerValues', markerValues);
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
		Polygon
	} from 'sveaflet';
	import { Button } from 'svelte-5-ui-lib';

	let map: any = $state(null);
	let centering = $state(false);

	let selectedMarkerIndex = -1;
	let mucLat = 48.137236594542834,
		mucLng = 11.576174072626772;
	let defaultCenter = $state([mucLat, mucLng]);
	let currPos = $state([mucLat, mucLng]);
	let posTime = $state(Date.now()); // TODO weg
	let nowTime = $state(Date.now());
	let defaultZoom = 15;

	window.setInterval(() => (nowTime = Date.now()), 1000); // TODO weg

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
		console.log('effect markers');
		markers();
	});

	const fctMap = new Map<string, any>();

	function markers() {
		for (const [index, mv] of markerValues.entries()) {
			console.log('setfct1', mv.dbFields.name, mv.mrk);
			if (mv.mrk) {
				const newfct = (e: any) => mclick(index, e);
				const oldfct = fctMap.get(mv.dbFields.id);
				console.log('setfct2', oldfct, newfct);
				if (oldfct) {
					mv.mrk.off('click', oldfct);
				}
				mv.mrk.on('click', newfct);
				fctMap.set(mv.dbFields.id, newfct);
			}
		}
	}

	function toggleDL() {
		document.documentElement.classList.toggle('dark');
	}

	function mclick(index: number, e: any) {
		console.log(
			'mc1',
			'index',
			selectedMarkerIndex,
			'centering',
			centering,
			'selected',
			markerValues[index].selected,
			'event',
			e
		);

		if (centering) {
			map.off('move', onMapMove);
			centering = false;
			const mv = markerValues[selectedMarkerIndex];
			nkState.persist(selectedMarkerIndex, { latLng: mv.latLng });
		}
		if (selectedMarkerIndex == -1) {
			const mv = markerValues[index];
			mv.selected = true;
			selectedMarkerIndex = index;
			// for (const [ix, mv] of markerValues.entries()) {
			// 	mv.selected = index === ix;
			// }
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
		console.log(
			'mc2',
			'index',
			selectedMarkerIndex,
			'centering',
			centering,
			'selected',
			markerValues[index].selected
		);
		// center = map.getCenter(); // to reposition
	}

	function onMapClick(e: any) {
		if (selectedMarkerIndex != -1) {
			const mv = markerValues[selectedMarkerIndex];
			mv.selected = false;
		}
	}

	function onMapMove(e: any) {
		const center = map.getCenter();
		markerValues[selectedMarkerIndex].latLng = center;
		console.log('omm');
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

	function editMarker() {
		if (selectedMarkerIndex == -1) return;
		const index = selectedMarkerIndex;
		const mv = markerValues[selectedMarkerIndex];
		selectedMarkerIndex = -1;
		mv.selected = false;
		goto('/editnk/' + index);
	}

	function deleteMarker() {
		console.log('deleteMarker', selectedMarkerIndex);
		if (selectedMarkerIndex == -1) return;
		nkState.deleteMarker(selectedMarkerIndex);
		selectedMarkerIndex = -1;
	}

	function centerMap() {
		map.flyTo(currPos, map.getZoom());
	}

	let locid = -1;
	let tid: NodeJS.Timeout | null = null;
	let geoloc = $state(false);

	function posSucc(pos: any) {
		console.log('posSucc', pos);
		const crd = pos.coords;
		currPos = [crd.latitude, crd.longitude];
		posTime = pos.timestamp;
	}

	function posErr(err: any) {
		console.log('Error', err);
		posRestart();
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
	}
</script>

{#snippet header()}
	<div class="sticky top-0 flex h-14 justify-start gap-4 bg-slate-100 p-2">
		<SidebarButton onclick={sidebarUi.toggle} class="mb-2" breakpoint="md" />
		<div class="w-full"></div>
		<Button outline pill onclick={logmap}>?</Button>
		<Button outline pill onclick={() => nkState.addMarker(map.getCenter())}>+</Button>
		<Button outline pill onclick={centerMap}>{'\u2316'}</Button>
		<Button outline pill onclick={posNow}>{'>'}</Button>
		<!-- <button class="btn bg-red-400" onclick={() => (showNav.value = !showNav.value)}>nav</button>
		<button class="btn bg-red-400 text-lg" onclick={toggleDL}>{'\u263E/\u263C'}</button> -->
	</div>
{/snippet}

{#snippet svmap()}
	<div style="width:100%;height:80vh;">
		<SVMap
			bind:instance={map}
			options={{
				center: defaultCenter,
				zoom: defaultZoom,
				maxZoom: 18,
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
			/>
			<ControlZoom options={{ position: 'topright' }} />
			<ControlAttribution
				options={{
					prefix:
						'&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
				}}
			/>
			{#key currPos}
				<Marker latLng={currPos}>
					<Popup class="w-20 text-center">
						Age: {Math.round((nowTime - posTime) / 1000)} // TODO weg
					</Popup>
				</Marker>
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
						<Popup class="flex w-20 flex-col items-center">
							{mv.dbFields.name}
							{#if mv.selected}
								<Button class="btn m-1 bg-red-400" onclick={moveMarker}>Verschieben</Button>
								<Button class="btn m-1 bg-red-400" onclick={editMarker}>Details</Button>
								<Button class="btn m-1 bg-red-400" onclick={deleteMarker}>Löschen</Button>
								<Button class="btn m-1 bg-red-400" onclick={toggleMarker}>Kontrolle</Button>
							{/if}
						</Popup>
					{/key}
				</Marker>
			{/each}
		</SVMap>
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
			<SidebarItem label="Dashboard" href="/"></SidebarItem>
			<SidebarItem label="Kanban" {spanClass} href="/"></SidebarItem>
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
