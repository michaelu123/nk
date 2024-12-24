<script lang="ts">
	import '../app.css';
	import { showNav } from '$lib/state.svelte';
	let { children } = $props();
	const hrefExample = '/';
</script>

<main>
	{@render children()}
</main>
