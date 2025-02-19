<script lang="ts">
	import { goto } from '$app/navigation';
	import ProposedInput from '$lib/components/ProposedInput.svelte';
	import { getState, State, type Region, type User } from '$lib/state.svelte';
	import { Map as SVMap, TileLayer, ControlZoom, ControlAttribution, Polygon } from 'sveaflet';
	import { onMount } from 'svelte';
	import { Button, Card, Input, Label, Modal, Progressbar, Range, Select } from 'svelte-5-ui-lib';
	import { SvelteMap } from 'svelte/reactivity';

	const xFactor = 3000.0;
	const yFactor = 4000.0;

	let nkState = getState();
	let { regions, region } = $derived(nkState);

	let { data } = $props();
	let { regionIdb, selectedRegion, regionsIdb, fetch, user } = data;
	nkState.updateRegion(regionIdb, selectedRegion, regionsIdb);

	let map: any = $state(null);
	let center = $state(nkState.region?.center || State.regionDefault.center);
	let zoom = $state(16);
	let xoff = $state(6);
	let yoff = $state(6);
	let isEditMode = $state(false);
	let isNewRegion = $state(false);
	let maxBounds = $derived.by(() => {
		if (region && !isEditMode) {
			return [region.lowerLeft, region.upperRight];
		}
		const lat = center[0];
		const lng = center[1];
		const x = xoff / xFactor;
		const y = yoff / yFactor;
		return [
			[lat - y, lng - x],
			[lat + y, lng + x]
		];
	});
	// svelte-ignore state_referenced_locally
	let regionName = $state(region?.name || '');
	// svelte-ignore state_referenced_locally
	let shortName = $state(region?.shortName || '');
	let errorMessage1 = $state('');
	let errorMessage2 = $state('');
	let progress = $state(0);

	let addingUser = $state(false);
	let addedUser = $state('');
	let userMap: Map<string, number> = new SvelteMap();
	let idMap: Map<string, string> = new Map();
	let regionUserNames: string[] = $state([]);
	let regionIdId: number;

	function onMapMove(e: any) {
		const mc = map.getCenter();
		center = [mc.lat, mc.lng];
	}

	$effect(() => {
		if (map && isEditMode) {
			map.off('move', onMapMove);
			map.on('move', onMapMove);
		}
	});

	onMount(() => {
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
				yoff = (center[0] - region!.lowerLeft[0]) * yFactor;
			}
		}
		isEditMode = !isEditMode;
	}

	async function selectRegion() {
		center = await nkState.selectRegion(shortName);
		regionName = nkState.region!.name;
		zoom = 18;
		await map.flyTo(center, zoom);
	}

	async function deleteRegion() {
		await nkState.deleteRegion(shortName);
		nkState.region = null;
		shortName = '';
	}

	function goBack() {
		regionName = region!.name;
		shortName = region!.shortName;
		center = region!.center;
		isEditMode = false;
		map.off('move', onMapMove);
	}

	function prefetchRegion() {
		navigator.serviceWorker.addEventListener('message', (m) => {
			progress = Math.round(m.data * 100);
		});
		navigator.serviceWorker.controller?.postMessage({ region: $state.snapshot(nkState.region) });
	}

	async function gotoRoot() {
		await selectRegion();
		nkState.fetchData();
		goto('/');
	}

	async function addUser() {
		addingUser = true;
		addedUser = '';
		regionUserNames = [];
		const response = await fetch!('/api/db?what=usr&region=' + shortName);
		const { allUsers, regionUsers, regionId } = await response.json();
		for (const userEntry of allUsers) {
			if (userEntry.id !== user!.id) {
				// don't add yourself
				userMap.set(userEntry.username, 1);
				idMap.set(userEntry.username, userEntry.id);
			}
		}
		for (const userEntry of regionUsers) {
			regionUserNames.push(userEntry.username);
		}
		regionIdId = regionId[0].id;
	}

	$effect(() => {
		if (userMap.get(addedUser)) {
			fetch!('/api/db?what=usrreg', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ userid: idMap.get(addedUser), region: regionIdId })
			}).then((resp: Response) => {
				if (resp.ok) {
					alert(`${addedUser} wurde als Betreuer für das Revier ${regionName} eingetragen`);
				} else {
					alert('error: ' + resp);
				}
			});
			addingUser = false;
		}
	});
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
	<div class="mb-4 flex flex-row flex-wrap justify-between">
		{#if region && region.name != 'default'}
			<Button class="m-4 w-min whitespace-nowrap" onclick={gotoRoot}>Zur Karte</Button>
			<Button class="m-4 w-min" onclick={() => toggleEditMode(false)}
				>{isEditMode ? 'Speichern' : 'Ändern'}</Button
			>
			<Button class="m-4 w-min" onclick={deleteRegion}>Löschen</Button>
			<Button class="m-4 w-min whitespace-nowrap" onclick={prefetchRegion}
				>Karten-Kacheln laden</Button
			>
			<Button class="m-4 w-min whitespace-nowrap" onclick={addUser}>Betreuer</Button>
		{/if}
		<Button class="m-4 w-min whitespace-nowrap" onclick={() => toggleEditMode(true)}
			>Neues Revier</Button
		>
	</div>
	{#if progress != 0}
		<div class="absolute left-1/4 top-1/3 z-[490] w-2/4">
			<Progressbar {progress} labelOutside="Fortschritt" size="h-6" />
		</div>
	{/if}
	{#if addingUser}
		<Modal
			class="z-[1900]"
			size="lg"
			title="Zusätzlichen Betreuer für {regionName} hinzufügen"
			modalStatus={addingUser}
			closeModal={() => (addingUser = false)}
		>
			<Card>
				<h3 class="py-4 font-semibold">Bisherige Betreuer:</h3>
				<ul>
					{#each regionUserNames as run}
						<li>- {run}</li>
					{/each}
				</ul>
			</Card>

			<Card>
				<h3 class="py-4 font-semibold">Betreuer hinzufügen:</h3>
				<ProposedInput itemMap={userMap} bind:value={addedUser} label="Betreuer"></ProposedInput>
			</Card>
		</Modal>
	{/if}
{/snippet}

<div class="flex h-screen flex-col p-6">
	{#if isEditMode}
		{@render editing()}
	{:else}
		{@render display()}
	{/if}
	<div class="w-full flex-auto">
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
			<!--p id="crosshair">{'\u2316'}</p-->
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
					maxNativeZoom: 18,
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
	</div>
</div>
