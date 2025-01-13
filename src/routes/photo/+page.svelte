<script lang="ts">
	import EasyCamera from '$lib/components/EasyCamera.svelte';
	import { Button } from 'svelte-5-ui-lib';
	import { getState } from '$lib/state.svelte';
	import { redirect } from '@sveltejs/kit';
	import { createDir, createFile, createWriter, writeFile, walkFS } from '$lib/fs.js';

	let width = $state(window.visualViewport?.width || 400);
	let camera: EasyCamera;

	let nkState = getState();
	let { data } = $props();
	let { rootDir } = data;
	let id = data.url.searchParams.get('mvid') || '9230'; // TODO weg
	if (!id) {
		redirect(302, '/');
	}

	const takePhoto = async () => {
		let blob = await camera.takePhoto();
		console.log('blob', blob);
		if (blob) {
			let { path, total } = await writeImg(id, blob);
			console.log('takePhoto', path, total);
			nkState.addPhoto(id, path);
		}
	};

	async function writeImg(name: string, blob: Blob): Promise<{ path: string; total: number }> {
		let now = new Date();
		let year = now.getFullYear().toString();
		let month = (now.getMonth() + 1).toString();
		let day = now.getDate().toString();
		let ydir = await createDir(rootDir!, year);
		let mdir = await createDir(ydir, month);
		let ddir = await createDir(mdir, day);
		let f = await createFile(ddir, name);
		let path = f.fullPath;
		let fw = await createWriter(f);
		let total = await writeFile(fw, blob);
		return { path, total };
	}
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
