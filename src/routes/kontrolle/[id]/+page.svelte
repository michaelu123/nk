<script lang="ts">
	import { goto } from '$app/navigation';
	import NKControl from '$lib/components/NKControl.svelte';
	import { getState, nk2str, type ControlEntry } from '$lib/state.svelte';
	import { redirect } from '@sveltejs/kit';
	import { Card } from 'svelte-5-ui-lib';

	let nkState = getState();
	let { nkSpecies, nkValues, isLoading } = $derived(nkState);
	let { data } = $props();
	if (!data.id) {
		redirect(302, '/');
	}
	let nkid = $derived(data.id);
	let nk = $derived(nkValues.find((m) => m.id == nkid));
	let today = new Date();
	today.setMilliseconds(0);
	let ctrl: ControlEntry = $state({
		id: 'nk' + data.id + '_' + Date.now().toString(),
		nkid: data.id, // nk?.id ?
		name: '',
		region: nkState.selectedRegion!,
		date: today,
		species: '',
		comment: '',
		image: null,
		cleaned: false,
		changedAt: null,
		createdAt: today,
		deletedAt: null
	});

	// Another effect hack: nk appears eventually, and only then do I want to init name, nkType etc.
	// when saving, I do not want this effect. So I call setStateBack in the effect only once..
	$effect(() => {
		console.log('1eff', nk ? nk2str(nk) : 'undef');
		if (nk && nkValues) {
			ctrl.name = nk!.name;
		}
		console.log('2eff', nk ? nk2str(nk) : 'undef');
	});

	function cb() {
		goto('/nk/' + nkid);
	}
</script>

{#if nk}
	<div id="details" class="overflow-x-clip">
		<h1 class="my-8 text-center text-2xl font-semibold">Nistkasten Kontrolle</h1>
		<Card class="m-4" size="xl">
			<div class="mb-4 flex">
				<p class="w-40 shrink-0 font-bold">Name</p>
				<p>{nk.name}</p>
			</div>
			<div class="mb-4 flex">
				<p class="w-40 shrink-0 font-bold">Typ</p>
				<p>{nk.nkType}</p>
			</div>
		</Card>

		<NKControl {nk} {ctrl} {nkSpecies} {cb} />
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
