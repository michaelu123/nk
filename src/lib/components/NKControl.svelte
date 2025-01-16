<script lang="ts">
	import type { ControlEntry, MarkerEntry } from '$lib/state.svelte';
	import { Button, Label, Textarea, Card, Checkbox, Spinner, P } from 'svelte-5-ui-lib';
	import { getState } from '$lib/state.svelte';
	import ProposedInput from './ProposedInput.svelte';
	import { goto } from '$app/navigation';
	import { fetchBlob } from '$lib/fs';

	interface Props {
		ctrl: ControlEntry;
		mv: MarkerEntry;
		nkSpecies: Map<string, number>;
		cb: Function | null;
	}
	let { ctrl, mv, nkSpecies, cb }: Props = $props();
	let nkState = getState();

	let isEditMode = $state(!!cb);
	let nkSpec = $state(ctrl.species ?? '');
	let errSpec = $state('');
	let comment = $state(ctrl.comment ?? '');
	let cleaned = $state(ctrl.cleaned);

	let imgUrl = $derived(fetchImage()); // a Promise<string> ! see https://github.com/sveltejs/svelte/issues/13722
	let showImage = $state(false);

	async function fetchImage(): Promise<string> {
		if (showImage && ctrl && ctrl.image && nkState.rootDir) {
			return fetchBlob(nkState.rootDir, ctrl.image);
		}
		return '';
	}

	async function toggleEditModeAndSaveToDatabase(takePhoto: boolean) {
		if (isEditMode) {
			if (!nkSpec) errSpec = 'Bitte Art angeben';
			if (!nkSpec) return;
			if (cb) {
				// called from /kontrolle/id, to add a new ctrl.
				if (mv.ctrls) {
					mv.ctrls = [ctrl, ...mv.ctrls];
				} else {
					mv.ctrls = [ctrl];
				}
			}
			await nkState.persistCtrl(mv, ctrl, { species: nkSpec, comment, cleaned });
			if (takePhoto) {
				goto(`/photo?mvid=${mv.id}&ctrlid=${ctrl.id}&nkname=${mv.name}`);
			} else if (cb) {
				cb();
			}
		}
		isEditMode = !isEditMode;
	}

	function setStateBack() {
		if (cb) {
			// i.e. if we add a control, cancel
			goto('/');
		} else {
			nkSpec = ctrl.species ?? '';
			comment = ctrl.comment ?? '';
			cleaned = ctrl.cleaned;
			isEditMode = false;
		}
	}
	function ctrlIsFromToday() {
		const createdAt = typeof ctrl.createdAt == 'string' ? new Date(ctrl.createdAt) : ctrl.createdAt;
		return Date.now() - createdAt.getTime() < 24 * 60 * 60 * 1000;
	}
	function getPhoto() {}
</script>

<Card class="m-4" size="xl" padding="sm">
	<div class="mb-4 flex flex-row items-center">
		<p class="w-40 shrink-0 font-bold">Datum</p>
		<p>
			{new Date(ctrl.date).toLocaleDateString()}
		</p>
		<p class="w-28 shrink-0 text-center font-bold">Gereinigt:</p>
		{#if isEditMode}
			<Checkbox bind:checked={cleaned} />
		{:else}
			<Checkbox disabled checked={cleaned} />
		{/if}
	</div>

	{#if isEditMode}
		<form class="my-4 mr-2 flex flex-col items-baseline gap-4">
			<ProposedInput itemMap={nkSpecies} bind:value={nkSpec} label="Art" />
			{#if errSpec}
				<p class="w-full text-center text-red-500">{errSpec}</p>
			{/if}

			<div class="flex w-full flex-row">
				<Label class="w-40 shrink-0" for="comment_id">Bemerkungen</Label>
				<Textarea name="comment" id="comment_id" bind:value={comment} rows={2}></Textarea>
			</div>
		</form>
		<Button class="m-2" onclick={() => toggleEditModeAndSaveToDatabase(false)}>Speichern</Button>
		{#if ctrlIsFromToday()}
			<Button class="m-2" onclick={() => toggleEditModeAndSaveToDatabase(true)}
				>Speichern und Bild aufnehmen</Button
			>
		{/if}
		<Button class="m-2 whitespace-nowrap" onclick={setStateBack}>Nicht speichern</Button>
	{:else}
		<div class="mb-4 mr-2 flex">
			<p class="w-40 shrink-0 font-bold">Art</p>
			<p>{ctrl.species}</p>
		</div>
		<div class="mb-4 mr-2 flex">
			<p class="w-40 shrink-0 font-bold">Bemerkungen</p>
			<Textarea name="comment" id="comment_id" value={comment} readonly rows={2}></Textarea>
		</div>
		<Button class="m-2" onclick={() => toggleEditModeAndSaveToDatabase(false)}>Ändern</Button>
		{#if ctrl.image}
			<Button class="m-2" onclick={() => (showImage = !showImage)}
				>Bild {showImage ? 'nicht' : ''} anzeigen</Button
			>
		{/if}
	{/if}
	{#await imgUrl}
		<Spinner size="16" />
	{:then url}
		{#if url}
			<img src={url} alt="" />
		{:else if showImage && ctrl.image}
			<p class="text-center text-red-300">Kann Bild {ctrl.image} nicht finden!</p>
		{/if}
	{/await}
</Card>
