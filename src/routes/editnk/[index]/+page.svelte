<script lang="ts">
	import { goto } from '$app/navigation';
	import { getState } from '$lib/state.svelte';
	let { data } = $props();
	let index = $derived(+data.index);
	$inspect('index', index);
	console.log('page index', data.index);
	let nkState = getState();
	let { markerValues } = nkState;
	let mv = $derived(markerValues[index]);
	$inspect('mv', mv);
	let isEditMode = $state(false);

	let name = $state('');
	let kind = $state('');
	let comment = $state('');
	$effect(() => {
		name = mv.dbFields.name;
		kind = mv.dbFields.kind;
		comment = mv.dbFields.comment;
	});

	function goBack() {
		history.back();
	}

	async function toggleEditModeAndSaveToDatabase() {
		if (isEditMode) {
			await nkState.persist(index, { name, kind, comment });
		}
		isEditMode = !isEditMode;
	}
</script>

<h1>EDITNK</h1>
<h2>Name {name}</h2>
<h2>Art {kind}</h2>
<h2>Kommentar {comment}</h2>
<h2>Zuletzt {mv.dbFields.lastCleaned}</h2>

{#if isEditMode}
	<input type="text" name="name" class="input" bind:value={name} />
{/if}
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
