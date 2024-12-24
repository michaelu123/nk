<script lang="ts">
	import { Map, TileLayer, Marker, Popup, Icon } from 'sveaflet';
	import { showNav } from '$lib/state.svelte';

	let map: any = $state(null);
	let centering = $state(false);

	let selectedMarkerIndex = -1;
	let mucLat = 48.137236594542834,
		mucLng = 11.576174072626772;
	let defaultCenter = $state([mucLat, mucLng]);
	let defaultZoom = 15;
	$inspect(defaultCenter);
	let props = $props();
	$inspect(props);

	interface MarkerEntry {
		latLng: number[];
		mrk: any | null;
		selected: boolean;
		color: 'green' | 'red';
		name: string;
	}

	let markerValues = $state<MarkerEntry[]>([
		{
			latLng: [mucLat + 0.001, mucLng + 0.001],
			mrk: null,
			selected: false,
			name: 'one',
			color: 'green'
		},
		{
			latLng: [mucLat - 0.001, mucLng + 0.001],
			mrk: null,
			selected: false,
			name: 'two',
			color: 'red'
		},
		{
			latLng: [mucLat + 0.001, mucLng - 0.001],
			mrk: null,
			selected: false,
			name: 'three',
			color: 'green'
		},
		{
			latLng: [mucLat - 0.001, mucLng - 0.001],
			mrk: null,
			selected: false,
			name: 'four',
			color: 'red'
		}
	]);

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

	// $effect(() => {
	// 	if (map) {
	// 		// map.on('click', onMapClick);
	// 		// map.on('move', onMapMove);
	// 		// map.setMaxZoom(16);
	// 		// map.setMinZoom(14);
	// 	}
	// });

	$effect(() => {
		if (markerValues) {
			markers();
		}
	});

	function posSucc(pos: any) {
		console.log('pos2', pos);
		const crd = pos.coords;
		console.log('crd', crd);
		defaultCenter = [crd.latitude, crd.longitude];
	}

	function posErr(err: any) {
		console.log('Error', err);
	}

	function toggleDL() {
		document.documentElement.classList.toggle('dark');
	}

	function addMarker(ll: any) {
		markerValues.push({
			latLng: [ll.lat, ll.lng],
			mrk: null,
			selected: false,
			color: markerValues.length % 2 === 0 ? 'green' : 'red',
			name: 'unbekannt'
		});
	}

	function mclick(index: number) {
		selectedMarkerIndex = index;
		for (const [ix, mv] of markerValues.entries()) {
			mv.selected = index === ix;
		}
		// center = map.getCenter(); // to reposition
	}

	function markers() {
		for (const [index, mv] of markerValues.entries()) {
			if (mv.mrk) {
				mv.mrk.on('click', (e: any) => mclick(index));
			}
		}
	}

	function onMapClick(e: any) {
		addMarker(e.latlng);
	}

	function onMapMove(e: any) {
		const center = map.getCenter();
		markerValues[selectedMarkerIndex].latLng = center;
		console.log('mm');
	}

	function logmap() {
		console.log('zoom', map.getZoom());
		console.log('center', map.getCenter());
	}

	function centerMarker() {
		if (selectedMarkerIndex == -1) return;
		console.log('centering', centering);
		if (centering) {
			map.off('move', onMapMove);
			centering = false;
			const mv = markerValues[selectedMarkerIndex];
			selectedMarkerIndex = -1;
			mv.selected = false;
		} else {
			map.on('move', onMapMove);
			centering = true;
			onMapMove(null);
		}
	}

	function deleteMarker() {
		if (selectedMarkerIndex == -1) return;
		markerValues.splice(selectedMarkerIndex, 1);
	}

	function toggleMarker() {
		if (selectedMarkerIndex == -1) return;
		const mv = markerValues[selectedMarkerIndex];
		selectedMarkerIndex = -1;
		mv.selected = false;
		mv.color = mv.color == 'red' ? 'green' : 'red';
	}

	function centerMap() {
		map.flyTo(defaultCenter, defaultZoom);
	}

	let geoloc = $state(false);
	// svelte-ignore non_reactive_update
	let locid = -1;
	let tid: NodeJS.Timeout | null = null;
	if ('geolocation' in navigator) {
		if (tid) clearTimeout(tid);
		tid = setTimeout(() => {
			geoloc = true;
			console.log('geolocation is available');
			navigator.geolocation.getCurrentPosition((position) => {
				console.log('pos1', position);
				defaultCenter = [position.coords.latitude, position.coords.longitude];
				centerMap();
			});
			let options = {
				enableHighAccuracy: false,
				timeout: 5000,
				maximumAge: 0
			};
			if (locid != -1) {
				navigator.geolocation.clearWatch(locid);
			}
			locid = navigator.geolocation.watchPosition(posSucc, posErr, options);
			console.log('locid', locid, tid);
		}, 1000);
	} else {
		geoloc = false;
		console.log('geolocation is available');
	}
</script>

<div class="sticky top-0 flex justify-end gap-2">
	<button class="btn bg-red-400" onclick={logmap}>?</button>
	<button class="btn bg-red-400 text-lg" onclick={() => addMarker(map.getCenter())}>+ </button>
	<button class="btn bg-red-400 text-3xl" onclick={centerMap}>{'\u2316'}</button>
	<!-- <button class="btn bg-red-400" onclick={() => (showNav.value = !showNav.value)}>nav</button>
	<button class="btn bg-red-400 text-lg" onclick={toggleDL}>{'\u263E/\u263C'}</button> -->
</div>

<div style="width:100%;height:80vh;">
	<Map
		bind:instance={map}
		options={{
			center: defaultCenter,
			zoom: defaultZoom,
			maxZoom: 18,
			minZoom: 14
		}}
		attribution={'&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'}
	>
		<p id="crosshair">{'\u2316'}</p>
		<TileLayer url={'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} />
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
						{mv.name}
						{#if centering}
							<button class="btn m-1 bg-red-400" onclick={centerMarker}>Fertig</button>
						{:else if mv.selected}
							<button class="btn m-1 bg-red-400" onclick={centerMarker}>Zentrieren</button>
							<button class="btn m-1 bg-red-400" onclick={toggleMarker}>Ändern</button>
							<button class="btn m-1 bg-red-400" onclick={deleteMarker}>Löschen</button>
							<button class="btn m-1 bg-red-400" onclick={toggleMarker}>Kontrolle</button>
						{/if}
					</Popup>
				{/key}
			</Marker>
		{/each}
	</Map>
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
