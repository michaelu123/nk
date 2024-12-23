<script lang="ts">
	import { Map, TileLayer, Marker, Popup, Icon } from 'sveaflet';
	let map: any = $state(null);
	let popup: any = $state(null);
	const corrs = [0, 0.001, -0.001];
	let popuplatLng = $state([51.513, -0.07]);
	let popupContent = $state('I am a standalone popup.');
	let center = $state([51.517836, -0.086477]);
	let selectedMarkerIndex = 0;

	interface MarkerEntry {
		latLng: number[];
		mrk: any | null;
		selected: boolean;
		color: 'green' | 'red';
	}
	let markerValues = $state<MarkerEntry[]>([
		{ latLng: [51.513, -0.09], mrk: null, selected: false, color: 'green' },
		{ latLng: [51.514, -0.09], mrk: null, selected: false, color: 'red' },
		{ latLng: [51.515, -0.09], mrk: null, selected: false, color: 'green' },
		{ latLng: [51.516, -0.09], mrk: null, selected: false, color: 'red' }
	]);

	const commonIconOptions = {
		iconSize: [40, 40], // size of the icon
		iconAnchor: [20, 40], // point of the icon which will correspond to marker's location
		popupAnchor: [-3, -76] // point from which the popup should open relative to the iconAnchor
	};

	import outlinedMarker from '$lib/assets/outlinedMarker.svg';
	const outlinedMarkerOptions = {
		...commonIconOptions,
		iconUrl: outlinedMarker
	};

	import filledMarker from '$lib/assets/filledMarker.svg';
	const filledMarkerOptions = {
		...commonIconOptions,
		iconUrl: filledMarker
	};

	import selectedMarker from '$lib/assets/selectedMarker.svg';
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
		}
		if (markerValues) {
			markers();
		}
	});

	function addMarker(ll: any) {
		markerValues.push({
			latLng: [ll.lat, ll.lng],
			mrk: null,
			selected: false,
			color: markerValues.length % 2 === 0 ? 'green' : 'red'
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
		popuplatLng = e.latlng;
		popupContent = 'You clicked the map at ' + e.latlng.toString();
		addMarker(e.latlng);
		// if (popup) {
		// 	popup.openOn(map);
		// }
	}

	function onMapMove(e: any) {
		center = map.getCenter(); // Marker sticks at center
	}

	function logmap() {
		console.log('zoom', map.getZoom());
		console.log('center', map.getCenter());
	}
	function centermap() {
		center = map.getCenter();
		console.log('center', center);
	}

	function deleteMarker() {
		markerValues.splice(selectedMarkerIndex, 1);
	}

	function toggleMarker() {
		const mv = markerValues[selectedMarkerIndex];
		mv.selected = false;
		mv.color = mv.color == 'red' ? 'green' : 'red';
	}
</script>

<div style="width:100%;height:500px;">
	<Map
		bind:instance={map}
		options={{
			center: [51.513, -0.09],
			zoom: 14,
			maxZoom: 19,
			minZoom: 14
		}}
		attribution={'&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'}
	>
		<p id="crosshair">{'\u2316'}</p>
		<TileLayer url={'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} />
		{#key center}
			<Marker class="marker" id="mymarker1234" latLng={center}>
				<Icon options={filledMarkerOptions} />
			</Marker>
		{/key}
		{#each markerValues as mv, index (mv['latLng'])}
			<Marker latLng={mv['latLng']} bind:instance={mv['mrk']} {index}>
				{#key mv['selected']}
					<Icon
						options={mv['selected']
							? selectedMarkerOptions
							: mv['color'] == 'red'
								? outlinedMarkerOptions
								: filledMarkerOptions}
					/>
				{/key}
			</Marker>
		{/each}
		{#key popupContent}
			<Popup bind:instance={popup} latLng={popuplatLng} options={{ content: popupContent }} />
		{/key}
	</Map>
</div>
<div class="mt-5">
	<button class="btn m-4 bg-red-400" onclick={logmap}>Log Map</button>
	<button class="btn m-4 bg-red-400" onclick={centermap}>Center Map</button>
	<button class="btn m-4 bg-red-400" onclick={deleteMarker}>Delete selected marker</button>
	<button class="btn m-4 bg-red-400" onclick={toggleMarker}>Toggle selected marker</button>
</div>

<!-- <button class="btn m-4 bg-red-400" onclick={markers}>Markers</button> -->

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
