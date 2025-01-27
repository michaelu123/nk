<script lang="ts">
	import { goto } from '$app/navigation';
	import NKControl from '$lib/components/NKControl.svelte';
	import { getState, type ControlEntry } from '$lib/state.svelte';
	import { redirect } from '@sveltejs/kit';
	import { Card } from 'svelte-5-ui-lib';

	let nkState = getState();
	let { nkSpecies, markerValues, isLoading } = $derived(nkState);
	let { data } = $props();
	if (!data.id) {
		redirect(302, '/');
	}
	let mvid = $derived(data.id);
	let mv = $derived(markerValues.find((m) => m.id == mvid));
	let today = new Date();
	today.setMilliseconds(0);
	let ctrl: ControlEntry = $state({
		id: 'mv' + data.id + '_' + Date.now().toString(),
		nkid: data.id, // mv?.id ?
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

	// Another effect hack: mv appears eventually, and only then do I want to init name, nkType etc.
	// when saving, I do not want this effect. So I call setStateBack in the effect only once..
	$effect(() => {
		console.log('1eff', mv ? mv.mv2str() : 'undef');
		if (mv && markerValues) {
			ctrl.name = mv!.name;
		}
		console.log('2eff', mv ? mv.mv2str() : 'undef');
	});

	function cb() {
		goto('/nk/' + mvid);
	}
</script>

{#if mv}
	<div id="details" class="overflow-x-clip">
		<h1 class="my-8 text-center text-2xl font-semibold">Nistkasten Kontrolle</h1>
		<Card class="m-4" size="xl">
			<div class="mb-4 flex">
				<p class="w-40 shrink-0 font-bold">Name</p>
				<p>{mv.name}</p>
			</div>
			<div class="mb-4 flex">
				<p class="w-40 shrink-0 font-bold">Typ</p>
				<p>{mv.nkType}</p>
			</div>
		</Card>

		<NKControl {mv} {ctrl} {nkSpecies} {cb} />
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
