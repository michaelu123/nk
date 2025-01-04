<script lang="ts">
	import { goto } from '$app/navigation';
	import ProposedInput from '$lib/components/ProposedInput.svelte';
	import NKControl from '$lib/components/NKControl.svelte';
	import { getState } from '$lib/state.svelte';
	import { redirect } from '@sveltejs/kit';
	import { Textarea, Label, Button, Input, Card } from 'svelte-5-ui-lib';

	let nkState = getState();
	let { nkTypes } = $derived(nkState);

	let { data } = $props();
	if (!data.id) {
		redirect(302, '/');
	}
	let id = $derived(data.id);
	let { markerValues } = nkState;
	let mv = $derived(markerValues.find((m) => m.dbFields.id == id));
	let isEditMode = $state(false);
	let name = $state('');
	let nkType = $state('');
	let comment = $state('');

	$effect(() => {
		if (mv) {
			setState();
		}
	});

	function setState() {
		name = mv!.dbFields.name;
		nkType = mv!.dbFields.nkType;
		comment = mv!.dbFields.comment;
		isEditMode = false;
	}
	function goBack() {
		history.back();
	}

	function goMap() {
		goto('/');
	}

	async function toggleEditModeAndSaveToDatabase() {
		if (isEditMode && mv) {
			console.log('comment1', comment);
			await nkState.persistNK(mv, { name, nkType, comment });
			await nkState.updNkTypes(nkType);
		}
		isEditMode = !isEditMode;
	}

	async function takePhoto() {
		console.log('takephoto');
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
				<ProposedInput itemMap={nkTypes} bind:value={nkType} />
				<div class="flex w-full flex-row">
					<Label class="w-40 shrink-0" for="comment_id">Bemerkungen</Label>
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
				<Button class="m-1" onclick={setState}>Nicht speichern</Button>
				<Button class="m-1" onclick={takePhoto}>Neues Bild aufnehmen</Button>
			{:else}
				<Button class="m-1" onclick={toggleEditModeAndSaveToDatabase}>Ändern</Button>
			{/if}
			<Button class="m-1" onclick={goBack}>Zurück zur Karte</Button>
		</div>

		{#if !isEditMode && mv.ctrls}
			<h1 class="m-4 text-lg font-bold">Kontrollen:</h1>
			{#each mv.ctrls ?? [] as ctrl (ctrl.id)}
				<NKControl {mv} {ctrl} />
			{/each}
		{/if}
	</div>
{/if}
