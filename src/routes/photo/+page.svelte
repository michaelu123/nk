<script lang="ts">
	import EasyCamera from '$lib/components/EasyCamera.svelte';
	import { Button } from 'svelte-5-ui-lib';
	import { getState } from '$lib/state.svelte';
	import { redirect } from '@sveltejs/kit';

	let width = $state(window.visualViewport?.width || 400);
	let camera: EasyCamera;

	let nkState = getState();
	let { data } = $props();
	let id = data.url.searchParams.get('mvid') || '9230'; // TODO weg
	if (!id) {
		redirect(302, '/');
	}

	const takePhoto = async () => {
		let blob = await camera.takePhoto();
		console.log('blob', blob);
		if (blob) {
			await nkState.addPhoto(id, blob);
		}

		// if ('launchQueue' in window && 'files' in LaunchParams.prototype) {
		// 	// The File Handling API is supported.
		// }
	};
</script>

<div class="relative">
	<div>
		<EasyCamera
			bind:width
			style="border-radius:5px;"
			bind:this={camera}
			autoOpen
			mirrorDisplay={false}
			useFrontCamera={false}
		/>
	</div>

	<div class="absolute bottom-4 flex w-full justify-center">
		<Button onclick={takePhoto}>Aufnehmen</Button>
	</div>
</div>
