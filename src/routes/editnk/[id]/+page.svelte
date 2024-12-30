<script lang="ts">
	import { goto } from '$app/navigation';
	import { getState } from '$lib/state.svelte';
	import { redirect } from '@sveltejs/kit';
	let { data } = $props();
	if (!data.id) {
		redirect(302, '/');
	}
	let id = $derived(data.id);
	$inspect('id', id);
	console.log('page id', data.id);
	let nkState = getState();
	let { markerValues } = nkState;
	let mv = $derived(markerValues.find((m) => m.dbFields.id == id));
	$inspect('mv', mv);
	let isEditMode = $state(false);

	let name = $state('');
	let kind = $state('');
	let comment = $state('');
	$effect(() => {
		if (mv) {
			name = mv.dbFields.name;
			kind = mv.dbFields.kind;
			comment = mv.dbFields.comment;
		}
	});

	function goBack() {
		history.back();
	}

	async function toggleEditModeAndSaveToDatabase() {
		if (isEditMode && mv) {
			await nkState.persist(mv, { name, kind, comment });
		}
		isEditMode = !isEditMode;
	}
</script>

{#if mv}
	<h1>EDITNK</h1>
	{#if isEditMode}
		<input type="text" name="name" class="input" bind:value={name} />
		<input type="text" name="kind" class="input" bind:value={kind} />
		<textarea name="kind" class="input" bind:value={comment}></textarea>
	{:else}
		<h2>Name {name}</h2>
		<h2>Art {kind}</h2>
		<h2>Kommentar {comment}</h2>
	{/if}
	<h2>Zuletzt {mv.dbFields.lastCleaned}</h2>

	<button onclick={toggleEditModeAndSaveToDatabase}>{isEditMode ? 'Save' : 'Edit'}</button>
	<a href="/editnk/0">ZERO</a>
	<a href="/editnk/1">ONE</a>
	<a href="/editnk/2">TWO</a>
	<a href="/editnk/3">THREE</a>
	<button onclick={() => goto('/editnk/0')}>BZERO</button>
	<button onclick={() => goto('/editnk/1')}>BONE</button>
	<button onclick={() => goto('/editnk/2')}>BTWO</button>
	<button onclick={() => goto('/editnk/3')}>BTHREE</button>
	<button onclick={goBack}>Back</button>
{/if}
