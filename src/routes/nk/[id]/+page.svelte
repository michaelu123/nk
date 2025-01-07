<script lang="ts">
	import { goto } from '$app/navigation';
	import ProposedInput from '$lib/components/ProposedInput.svelte';
	import NKControl from '$lib/components/NKControl.svelte';
	import { getState } from '$lib/state.svelte';
	import { error, redirect } from '@sveltejs/kit';
	import { Textarea, Label, Button, Input, Card } from 'svelte-5-ui-lib';

	let nkState = getState();
	let { nkTypes, nkSpecies, markerValues, isLoading } = $derived(nkState);
	let { data } = $props();
	if (!data.id) {
		redirect(302, '/');
	}
	let id = $derived(data.id);
	let mv = $derived(markerValues.find((m) => m.dbFields.id == id));
	let isEditMode = $state(data.url.searchParams.toString().includes('change='));
	let name = $state('');
	let nkType = $state('');
	let comment = $state('');
	let inited = $state(false);
	let errName = $state('');
	let errType = $state('');
	let image: string = $state('');

	// Another effect hack: mv appears eventually, and only then do I want to init name, nkType etc.
	// when saving, I do not want this effect. So I call setStateBack in the effect only once...
	$effect(() => {
		console.log('1eff', mv ? mv.mv2str() : 'undef', inited);
		if (mv && markerValues && !inited) {
			setStateBack();
			inited = true;
		}
		console.log('2eff', mv ? mv.mv2str() : 'undef', inited);
	});

	function setStateBack() {
		name = mv!.dbFields.name;
		nkType = mv!.dbFields.nkType;
		comment = mv!.dbFields.comment;
		image = mv!.dbFields.image ?? '';
		isEditMode = inited ? false : data.url.searchParams.toString().includes('change=');
	}

	function goBack() {
		// history.back();
		goto('/');
	}

	async function toggleEditModeAndSaveToDatabase() {
		if (isEditMode && mv) {
			if (!name) errName = 'Bitte Namen vergeben';
			if (!nkType) errType = 'Bitte Nistkastentyp vergeben';
			if (!name || !nkType) return;
			await nkState.persistNK(mv, { name, nkType, comment, image });
			nkState.updNkTypes(nkType);
			goBack();
		}
		isEditMode = !isEditMode;
	}

	async function takePhoto() {
		if (!name) errName = 'Bitte Namen vergeben';
		if (!nkType) errType = 'Bitte Nistkastentyp vergeben';
		if (!name || !nkType) return;
		console.log('takephoto');
		image = 'xxx';
	}
</script>

{#if mv}
	<div id="details" class="overflow-x-clip">
		<h1 class="my-8 text-center text-2xl font-semibold">Nistkasten</h1>
		<div class="m-1 flex items-center justify-center">
			{#if mv.dbFields.image || mv.dbFields.name.includes('2')}
				<img src="/src/lib/assets/rewards-header-image-witcher3@2x.webp" alt="" />
			{:else}
				<button onclick={takePhoto}>
					<img src="/src/lib/assets/photo-camera-svgrepo-com.svg" alt="" />
				</button>
			{/if}
		</div>

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
					<Label class="w-40 shrink-0" for="comment_id">Kommentar:</Label>
					<Textarea name="comment" id="comment_id" bind:value={comment} rows={2}></Textarea>
				</div>
			</form>
		{:else}
			<Card class="m-4" size="xl">
				<div class="mb-4 flex">
					<p class="w-40 shrink-0 font-bold">Name</p>
					<p>{mv.dbFields.name}</p>
				</div>
				<div class="mb-4 flex">
					<p class="w-40 shrink-0 font-bold">Typ</p>
					<p>{mv.dbFields.nkType}</p>
				</div>
				<div class="mb-4 flex">
					<p class="w-40 shrink-0 font-bold">Zuletzt geputzt</p>
					<p>
						{mv.dbFields.lastCleaned ? new Date(mv.dbFields.lastCleaned!).toLocaleDateString() : ''}
					</p>
				</div>
				<div class="mb-4 flex">
					<p class="w-40 shrink-0 font-bold">Kommentar</p>
					<Textarea name="comment" id="comment_id" value={mv.dbFields.comment} readonly rows={2}
					></Textarea>
				</div>
			</Card>
		{/if}

		<div class="mb-4 ml-4 mt-6 text-left">
			{#if isEditMode}
				<Button class="m-1" onclick={toggleEditModeAndSaveToDatabase}>Speichern</Button>
				{#if mv.dbFields.name && mv.dbFields.nkType}
					<Button class="m-1" onclick={setStateBack}>Nicht speichern</Button>
					<Button class="m-1" onclick={goBack}>Zurück zur Karte</Button>
					<Button class="m-1" onclick={takePhoto}>Neues Bild aufnehmen</Button>
				{/if}
			{:else}
				<Button class="m-1" onclick={toggleEditModeAndSaveToDatabase}>Ändern</Button>
				<Button class="m-1" onclick={goBack}>Zurück zur Karte</Button>
			{/if}
		</div>

		{#if !isEditMode && mv.ctrls}
			<h1 class="m-4 text-lg font-bold">Kontrollen:</h1>
			{#each mv.ctrls ?? [] as ctrl (ctrl.id)}
				<NKControl {mv} {ctrl} {nkSpecies} />
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
