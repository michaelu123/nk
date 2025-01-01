<script lang="ts">
	import '../app.css';
	import { setState } from '$lib/state.svelte';
	let { children, data } = $props();
	setState({ user: data.user, idb: data.idb, bucket: data.bucket });
</script>

<main>
	{@render children()}
</main>
