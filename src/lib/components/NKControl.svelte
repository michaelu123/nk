<script lang="ts">
	import type { ControlEntry, MarkerEntry } from '$lib/state.svelte';
	import { Button, Label, Input, Textarea, Card } from 'svelte-5-ui-lib';
	import { getState } from '$lib/state.svelte';
	import ProposedInput from './ProposedInput.svelte';

	interface Props {
		ctrl: ControlEntry;
		mv: MarkerEntry;
		nkSpecies: Map<string, number>;
	}
	let { ctrl, mv, nkSpecies }: Props = $props();
	let nkState = getState();

	let isEditMode = $state(false);
	let nkSpec = $state(ctrl.species ?? '');
	let comment = $state(ctrl.comment);

	async function toggleEditModeAndSaveToDatabase() {
		if (isEditMode) {
			await nkState.persistCtrl(ctrl, { species: nkSpec, comment });
		}
		isEditMode = !isEditMode;
	}
</script>

<Card class="m-4" size="xl" padding="sm">
	<div class="mb-4 flex flex-row items-center">
		<p class="w-40 shrink-0 font-bold">Datum</p>
		<p>
			{new Date(ctrl.date).toLocaleDateString()}
		</p>
		<div class="w-full"></div>
		{#if isEditMode}
			<Button class="mr-2" onclick={toggleEditModeAndSaveToDatabase}>Speichern</Button>
			<Button class="whitespace-nowrap" onclick={() => (isEditMode = false)}>Nicht speichern</Button
			>
		{:else}
			<Button onclick={toggleEditModeAndSaveToDatabase}>Ändern</Button>
			{#if ctrl.image}
				<Button onclick={() => {}}>Bild</Button>
			{/if}
		{/if}
	</div>

	{#if isEditMode}
		<form class="m-4 flex flex-col items-baseline gap-4">
			<ProposedInput itemMap={nkSpecies} bind:value={nkSpec} label="Art" />
			<div class="flex w-full flex-row">
				<Label class="w-40 shrink-0" for="comment_id">Bemerkungen</Label>
				<Textarea name="comment" id="comment_id" bind:value={comment!} rows={2}></Textarea>
			</div>
		</form>
	{:else}
		<div class="mb-4 flex">
			<p class="w-40 shrink-0 font-bold">Art</p>
			<p>{ctrl.species}</p>
		</div>
		<div class="mb-4 flex">
			<p class="w-40 shrink-0 font-bold">Beschreibung</p>
			<Textarea name="comment" id="comment_id" value={comment!} readonly rows={2}></Textarea>
		</div>
	{/if}
</Card>
