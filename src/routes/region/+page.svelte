<script lang="ts">
	import { goto } from '$app/navigation';
	import { getState, State, type Region } from '$lib/state.svelte';
	import { Map as SVMap, TileLayer, ControlZoom, ControlAttribution, Polygon } from 'sveaflet';
	import { onMount } from 'svelte';
	import { Button, Input, Label, Range, Select } from 'svelte-5-ui-lib';

	const xFactor = 3000;
	const yFactor = 4000;

	let nkState = getState();
	let { regions, region } = $derived(nkState);

	let map: any = $state(null);
	let center = $state(nkState.region?.center || State.regionDefault.center);
	$inspect('center', center);
	let zoom = $state(16);
	let xoff = $state(6);
	let yoff = $state(6);
	let isEditMode = $state(false);
	let isNewRegion = $state(false);
	let maxBounds = $derived.by(() =>
		region && !isEditMode
			? [region.lowerLeft, region.upperRight]
			: [
					[center[0] + yoff / yFactor, center[1] - xoff / xFactor],
					[center[0] - yoff / yFactor, center[1] + xoff / xFactor]
				]
	);
	// svelte-ignore state_referenced_locally
	let regionName = $state(region?.name || '');
	// svelte-ignore state_referenced_locally
	let shortName = $state(region?.shortName || '');
	let errorMessage1 = $state('');
	let errorMessage2 = $state('');

	function onMapMove(e: any) {
		const mc = map.getCenter();
		center[0] = mc.lat;
		center[1] = mc.lng;
	}

	$effect(() => {
		if (map && isEditMode) {
			map.off('move', onMapMove);
			map.on('move', onMapMove);
		}
	});

	onMount(() => {
		console.log('onmount', regions, region);
		isEditMode = !regions || regions.length == 0;
		isNewRegion = isEditMode;
	});

	async function toggleEditMode(newreg: boolean) {
		map.off('move', onMapMove);
		isNewRegion = newreg;
		if (isEditMode) {
			if (!regionName) {
				errorMessage1 = 'Bitte einen Namen eingeben';
				return;
			}
			if (isNewRegion) {
				for (const r of regions) {
					if (r.name == regionName) {
						errorMessage1 = 'Bitte einen anderen Namen wählen';
						return;
					}
				}
				if (!shortName) {
					errorMessage2 = 'Bitte einen Kurznamen eingeben (nicht mehr als 6 Zeichen)';
					return;
				}
				if (shortName.length > 6) {
					errorMessage2 = 'Bitte nicht mehr als 6 Zeichen';
					return;
				}
				for (const r of regions) {
					if (r.shortName == shortName) {
						errorMessage1 = 'Bitte einen anderen Kurznamen wählen';
						return;
					}
				}
			}
			let newRegion: Region = {
				name: regionName,
				shortName,
				lowerLeft: maxBounds[0],
				upperRight: maxBounds[1],
				center: [(maxBounds[0][0] + maxBounds[1][0]) / 2, (maxBounds[0][1] + maxBounds[1][1]) / 2]
			};
			await nkState.addOrUpdateRegion(newRegion);
			if (newreg) {
				newreg = false;
				goto('/');
			}
		} else {
			map.on('move', onMapMove);
			if (isNewRegion) {
				regionName = '';
				shortName = '';
				center = State.regionDefault.center;
				xoff = 6;
				yoff = 6;
			} else {
				center = region!.center;
				xoff = (center[1] - region!.lowerLeft[1]) * xFactor;
				yoff = (region!.lowerLeft[0] - center[0]) * yFactor;
			}
		}
		isEditMode = !isEditMode;
	}

	function selectRegion(e: any) {
		const sname = e.target.value;
		const rg = regions.find((r) => r.shortName == sname);
		nkState.selectRegion(sname);
		center = rg!.center;
		nkState.updDefaultCenter(rg!.center, map.getZoom());
		const options = { animate: false };
		map.flyTo(center, map.getZoom(), options);
	}

	function deleteRegion(e: any) {
		const sname = e.target.value;
		console.log('delete', shortName);
		// nkState.deleteRegion(sname);
	}

	function goBack() {
		regionName = region!.name;
		shortName = region!.shortName;
		center = region!.center;
		isEditMode = false;
		map.off('move', onMapMove);
	}
</script>

{#snippet editing()}
	<h1 class="text-center font-bold">{isNewRegion ? 'Neues Revier anlegen' : 'Revier ändern'}</h1>
	<Label for="regionname" class="mb-4">
		Name des Reviers
		<Input
			id="regionname"
			name="regionname"
			type="text"
			placeholder="Name"
			bind:value={regionName}
			size="lg"
			class="pl-10"
		/>
	</Label>
	{#if errorMessage1}
		<h4 class="m-1 text-center text-red-500">
			{errorMessage1}
		</h4>
	{/if}
	{#if isNewRegion}
		<Label for="shortname" class="mb-4">
			Kurzform des Namens (max 6 Zeichen)
			<Input
				id="shortname"
				name="shortname"
				type="text"
				placeholder="Kurzname"
				bind:value={shortName}
				size="lg"
				class="pl-10"
			/>
		</Label>
	{/if}
	{#if errorMessage2}
		<h4 class="m-1 text-center text-red-500">
			{errorMessage2}
		</h4>
	{/if}
	<h1>
		Bitte mit den Reglern und dem Verschieben und Zoomen der Karte ein Rechteck festlegen, das das
		Revier umschließt.
	</h1>
	<div class="m-4 flex w-full flex-row gap-1">
		<Range color="blue" rangeSize="lg" bind:value={xoff} />
		<Range color="blue" rangeSize="lg" bind:value={yoff} />
	</div>
	<div class="mb-4 flex flex-row flex-wrap">
		<Button class="m-4 w-min" onclick={() => toggleEditMode(false)}
			>{isEditMode ? 'Speichern' : 'Ändern'}</Button
		>
		<Button class="m-4 w-min whitespace-nowrap" onclick={goBack}>Nicht speichern</Button>
	</div>
{/snippet}

{#snippet display()}
	<h1 class="mb-4 text-center text-xl font-bold">Revier auswählen</h1>
	<div class="mb-4 flex flex-row">
		<Label class="w-40 shrink-0" for="value_select">Revier auswählen:</Label>
		<Select
			class=""
			name="regionselect"
			id="value-select"
			bind:value={shortName}
			onchange={selectRegion}
		>
			{#each regions as r}
				<option value={r.shortName}>{r.name}</option>
			{/each}
		</Select>
	</div>
	<!-- {#if region}
		<Label for="regionname" class="mb-4">
			Name des Reviers
			<Input
				id="regionname"
				name="regionname"
				type="text"
				placeholder="Name"
				bind:value={region.name}
				size="lg"
				class="pl-10"
				readonly={true}
			/>
		</Label>
		<Label for="shortname" class="mb-4">
			Kurzform des Namens
			<Input
				id="shortname"
				name="shortname"
				type="text"
				placeholder="Kurzname"
				bind:value={region.shortName}
				size="lg"
				class="pl-10"
				readonly={true}
			/>
		</Label>
	{/if} -->
	<div class="mb-4 flex flex-row flex-wrap">
		{#if region}
			<Button class="m-4 w-min whitespace-nowrap" onclick={() => goto('/')}>Zur Karte</Button>
			<Button class="m-4 w-min" onclick={() => toggleEditMode(false)}
				>{isEditMode ? 'Speichern' : 'Ändern'}</Button
			>
			<Button class="m-4 w-min" onclick={deleteRegion}>Löschen</Button>
		{/if}
		<Button class="m-4 w-min" onclick={() => toggleEditMode(true)}>Neu</Button>
	</div>
{/snippet}

<div class="flex h-screen flex-col p-6">
	{#if isEditMode}
		{@render editing()}
	{:else}
		{@render display()}
	{/if}
	<div class="w-full flex-auto">
		{#key center}
			<SVMap
				bind:instance={map}
				options={{
					center,
					zoom,
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
			</SVMap>
		{/key}
	</div>
</div>
