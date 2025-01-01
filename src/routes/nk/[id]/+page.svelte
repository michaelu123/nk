<script lang="ts">
	import { goto } from '$app/navigation';
	import { getState } from '$lib/state.svelte';
	import { redirect } from '@sveltejs/kit';
	import { Textarea, Label, Button, Input } from 'svelte-5-ui-lib';

	let nkState = getState();
	let { nkTypes } = $derived(nkState);

	let { data } = $props();
	if (!data.id) {
		redirect(302, '/');
	}
	let id = $derived(data.id);
	console.log('page id', data.id);
	let { markerValues } = nkState;
	let mv = $derived(markerValues.find((m) => m.dbFields.id == id));
	let isEditMode = $state(true);

	let name = $state('');
	let nkType = $state('');
	let comment = $state('');
	$effect(() => {
		if (mv) {
			name = mv.dbFields.name;
			nkType = mv.dbFields.nkType;
			comment = mv.dbFields.comment;
		}
	});

	function goBack() {
		history.back();
	}

	function goMap() {
		goto('/');
	}

	async function toggleEditModeAndSaveToDatabase() {
		if (isEditMode && mv) {
			await nkState.persist(mv, { name, nkType, comment });
			await nkState.updNkTypes(nkType);
		}
		isEditMode = !isEditMode;
	}

	let nkTypeList: string[] = $derived.by(() => {
		let keys = nkTypes.keys().toArray();
		let uc = nkType.toUpperCase();
		keys = keys.filter((k) => k.toUpperCase().includes(uc));
		keys = keys.toSorted((b, a) => nkTypes.get(a)! - nkTypes.get(b)!);
		keys = keys.slice(0, 8);
		return keys;
	});
</script>

{#if mv}
	<h1 class="mt-8 text-center text-2xl font-semibold">Nistkasten</h1>
	{#if isEditMode}
		<form class="m-4 flex flex-col items-baseline gap-4">
			<div class="flex flex-row">
				<Label class="w-40" for="name_id">Name:</Label>
				<Input type="text" id="name_id" name="name" class="input" bind:value={name} />
			</div>
			<div class="flex flex-row">
				<Label class="w-40" for="nktype_id">Typ:</Label>
				<Input list="nktypelist" id="nktype_id" name="nktype" bind:value={nkType} />

				<datalist id="nktypelist">
					{#each nkTypeList as nkt}
						<option value={nkt}></option>
					{/each}
				</datalist>
			</div>

			<div class="flex flex-row">
				<Label class="w-40" for="comment_id">Bemerkungen</Label>
				<Textarea name="comment" id="comment_id" bind:value={comment}></Textarea>
			</div>
		</form>
	{:else}
		<h2>Name {name}</h2>
		<h2>Art {nkType}</h2>
		<h2>Kommentar {comment}</h2>
	{/if}
	<h2>Zuletzt {mv.dbFields.lastCleaned}</h2>

	<Button onclick={toggleEditModeAndSaveToDatabase}>{isEditMode ? 'Save' : 'Edit'}</Button>
	<a href="/nk/one">ONE</a>
	<a href="/nk/two">TWO</a>
	<a href="/nk/three">THREE</a>
	<a href="/nk/four">FOUR</a>
	<Button onclick={() => goto('/nk/one')}>BONE</Button>
	<Button onclick={() => goto('/nk/two')}>BTWO</Button>
	<Button onclick={() => goto('/nk/three')}>BTHREE</Button>
	<Button onclick={() => goto('/nk/four')}>BFOUR</Button>
	<Button onclick={goBack}>Back</Button>
	<Button onclick={goMap}>Map</Button>
{/if}

<h2>{nkType}</h2>
