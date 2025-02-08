<script lang="ts">
	import EasyCamera from '$lib/components/EasyCamera.svelte';
	import { Button } from 'svelte-5-ui-lib';
	import { getState } from '$lib/state.svelte';
	import { createDir, createFile, createWriter, writeFile } from '$lib/fs.js';
	import { goto } from '$app/navigation';

	let width = $state(window.visualViewport?.width || 400);
	let camera: EasyCamera;

	let nkState = getState();
	let { data } = $props();
	let { rootDir } = data;
	let username = nkState.user?.username;
	let nkid = data.url.searchParams.get('nkid');
	let ctrlid = data.url.searchParams.get('ctrlid');
	let nkName = data.url.searchParams.get('nkname');

	const takePhoto = async () => {
		let blob = await camera.takePhoto();
		let msec = Date.now().toString();
		console.log('blob', blob);
		if (blob) {
			let { path, total } = await writeImg(msec, blob);
			console.log('takePhoto', path, total);
			await nkState.addPhoto(nkid!, ctrlid, path);
		}
		goto('/nk/' + nkid);
	};

	async function writeImg(msec: string, blob: Blob): Promise<{ path: string; total: number }> {
		let now = new Date();
		now.setMilliseconds(0);

		let year = now.getFullYear().toString();
		let month = (now.getMonth() + 1).toString();
		let day = now.getDate().toString();
		let ydir = await createDir(rootDir!, year);
		let mdir = await createDir(ydir, month);
		let ddir = await createDir(mdir, day);
		let udir = await createDir(ddir, username!);
		let f = await createFile(udir, nkName + '_' + msec + '.png');
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
