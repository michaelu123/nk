<script lang="ts">
	import { goto } from '$app/navigation';
	import ProposedInput from '$lib/components/ProposedInput.svelte';
	import NKControl from '$lib/components/NKControl.svelte';
	import { getState, MarkerEntry, type ControlEntry } from '$lib/state.svelte';
	import { redirect, error } from '@sveltejs/kit';
	import { Textarea, Label, Button, Input, Card, Checkbox, Spinner } from 'svelte-5-ui-lib';
	import { fetchBlobUrl } from '$lib/fs.js';

	let nkState = getState();
	let { nkTypes, nkSpecies, markerValues, isLoading } = $derived(nkState);
	let { data } = $props();
	if (!data.id) {
		redirect(302, '/');
	}
	let id = $state(data.id);
	let nknew = $state(data.id == 'new');
	const ll = data.url.searchParams.get('ll') || '';
	let mv = $derived(nknew ? newMV(ll) : markerValues.find((m) => m.id == id));
	const sp = data.url.searchParams.toString();
	let change = $state(sp.includes('change'));
	// svelte-ignore state_referenced_locally
	let isEditMode = $state(change || nknew);
	let name = $state('');
	let nkType = $state('');
	let comment = $state('');
	let inited = $state(false);
	let errName = $state('');
	let errType = $state('');
	let image: string = $state('');
	let imgUrl = $derived(fetchImage()); // a Promise<string> ! see https://github.com/sveltejs/svelte/issues/13722

	let cleaned = $state(true);

	async function fetchImage(): Promise<string> {
		if (mv && mv.image && data.rootDir) {
			return await fetchBlobUrl(data.rootDir, mv.image);
		}
		return '';
	}

	function newMV(coords?: string): MarkerEntry {
		if (!coords) error(404, 'missing parameter ll=lat,lng');
		const latlng = coords.split(',');
		const lat = +latlng[0],
			lng = +latlng[1];
		const today = new Date();
		today.setMilliseconds(0);

		const id = today.valueOf().toString();
		const mv = new MarkerEntry({
			latLng: [lat, lng],
			ctrls: [],
			selected: false,
			color: 'red',
			lastCleaned: null,
			id,
			name: '',
			region: nkState.selectedRegion!,
			nkType: '',
			comment: '',
			image: null,
			createdAt: today,
			changedAt: null,
			deletedAt: null
		});
		return mv;
	}

	// Another effect hack: mv appears eventually, and only then do I want to init name, nkType etc.
	// when saving, I do not want this effect. So I call setStateBack in the effect only once..
	$effect(() => {
		// console.log('1eff', mv ? mv.mv2str() : 'undef', inited);
		if (mv && markerValues && !inited) {
			setStateBack();
			inited = true;
		}
		// console.log('2eff', mv ? mv.mv2str() : 'undef', inited);
	});

	function setStateBack() {
		name = mv!.name;
		nkType = mv!.nkType;
		comment = mv!.comment;
		image = mv!.image ?? '';
		isEditMode = inited ? false : nknew || change;
	}

	function goBack() {
		// history.back();
		goto('/');
	}

	async function toggleEditModeAndSaveToDatabase(takePhoto: boolean) {
		if (isEditMode && mv) {
			if (!name) errName = 'Bitte Namen vergeben';
			if (!nkType) errType = 'Bitte Nistkastentyp vergeben';
			if (!name || !nkType) return;
			await nkState.persistNK(mv, { name, nkType, comment, image });
			if (nknew) {
				markerValues.push(mv);
			}
			if (nknew && cleaned) {
				const today = new Date();
				today.setMilliseconds(0);
				const ctrl: ControlEntry = {
					id: 'mv' + mv.id + '_' + Date.now().toString(),
					nkid: mv.id,
					name: mv.name,
					region: mv.region,
					date: today,
					species: null,
					comment: 'Neu aufgehängt',
					image: null,
					cleaned: true,
					createdAt: today,
					changedAt: null,
					deletedAt: null
				};
				mv.ctrls = [ctrl];
				nkState.persistCtrl(mv, ctrl, {});
			}
			nkState.updNkTypes(nkType);
			if (nknew && takePhoto) {
				goto(`/photo?mvid=${mv.id}&nkname=${mv.name}`);
			} else {
				goBack();
			}
		}
		isEditMode = !isEditMode;
	}

	async function takePhoto() {
		if (!name) errName = 'Bitte Namen vergeben';
		if (!nkType) errType = 'Bitte Nistkastentyp vergeben';
		if (!name || !nkType) return;
		goto(`/photo?mvid=${mv!.id}&nkname=${mv!.name}`);
	}
</script>

{#snippet buttons(mv: MarkerEntry)}
	<div class="mb-1 ml-4 mt-0 text-left">
		{#if isEditMode}
			<Button class="m-1" onclick={() => toggleEditModeAndSaveToDatabase(false)}>Speichern</Button>
			{#if nknew}
				<Button class="m-1" onclick={() => toggleEditModeAndSaveToDatabase(true)}
					>Speichern und Bild aufnehmen</Button
				>
			{/if}
			{#if mv.name && mv.nkType}
				<Button class="m-1" onclick={setStateBack}>Nicht speichern</Button>
				<Button class="m-1" onclick={goBack}>Zurück zur Karte</Button>
				<Button class="m-1" onclick={takePhoto}>Neues Bild aufnehmen</Button>
			{/if}
		{:else}
			<Button class="m-1" onclick={() => toggleEditModeAndSaveToDatabase(false)}>Ändern</Button>
			<Button class="m-1" onclick={goBack}>Zurück zur Karte</Button>
			<Button class="m-1" href={'/kontrolle/' + mv.id}>Neue Kontrolle</Button>
		{/if}
	</div>
{/snippet}

{#if mv}
	<div id="details" class="overflow-x-clip">
		<h1 class="my-1 text-center text-2xl font-semibold">Nistkasten</h1>
		{#if !nknew}
			<div class="m-1 flex items-center justify-center">
				{#await imgUrl}
					<Spinner size="16" />
				{:then url}
					{#if url}
						<img src={url} alt="" />
					{:else}
						<button onclick={takePhoto}>
							<img src="/photo-camera-svgrepo-com.svg" alt="" />
							<p>Photo aufnehmen</p>
						</button>
					{/if}
				{/await}
			</div>
		{/if}
		{#if isEditMode}
			<form class="m-4 flex flex-col items-baseline gap-4">
				<div class="flex w-full flex-row">
					<Label class="w-40 shrink-0" for="name_id">Name:</Label>
					<Input type="text" id="name_id" name="name" class="input" bind:value={name} />
				</div>
				{#if errName}
					<p class="w-full text-center text-red-500">{errName}</p>
				{/if}
				<ProposedInput itemMap={nkTypes} bind:value={nkType} label="Typ" />
				{#if errType}
					<p class="w-full text-center text-red-500">{errType}</p>
				{/if}
				<div class="flex w-full flex-row">
					<Label class="w-40 shrink-0" for="comment_id">Bemerkungen:</Label>
					<Textarea name="comment" id="comment_id" bind:value={comment} rows={2}></Textarea>
				</div>
				{#if nknew}
					<div class="flex w-full flex-row">
						<Label class="w-40 shrink-0" for="comment_id">Gereinigt:</Label>
						<Checkbox bind:checked={cleaned} />
					</div>
				{/if}
			</form>
			{@render buttons(mv)}
		{:else}
			<Card class="m-1" size="xl">
				<div class="mb-4 flex">
					<p class="w-40 shrink-0 font-bold">Name</p>
					<p>{mv.name}</p>
				</div>
				<div class="mb-4 flex">
					<p class="w-40 shrink-0 font-bold">Typ</p>
					<p>{mv.nkType}</p>
				</div>
				<div class="mb-4 flex">
					<p class="w-40 shrink-0 font-bold">Zuletzt geputzt</p>
					<p>
						{mv.lastCleaned ? new Date(mv.lastCleaned!).toLocaleDateString() : ''}
					</p>
				</div>
				<div class="mb-4 flex">
					<p class="w-40 shrink-0 font-bold">Bemerkungen</p>
					<Textarea name="comment" id="comment_id" value={mv.comment} readonly rows={2}></Textarea>
				</div>
				{@render buttons(mv)}
			</Card>
		{/if}

		{#if !isEditMode && mv.ctrls}
			<h1 class="m-2 text-lg font-bold">Kontrollen:</h1>
			{#each mv.ctrls ?? [] as ctrl (ctrl.id)}
				<NKControl {mv} {ctrl} {nkSpecies} cb={null} />
			{/each}
		{/if}
	</div>
{:else if isLoading}
	<div class="flex h-screen w-screen flex-col items-center justify-center gap-8">
		<h1 class="text-4xl">Daten werden geladen</h1>
	</div>
{:else}
	<div class="flex h-screen w-screen flex-col items-center justify-center gap-8">
		<h1 class="text-4xl">Nicht gefunden</h1>
	</div>
{/if}
