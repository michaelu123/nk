<script lang="ts">
	import '../app.css';
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	let { children } = $props();
</script>

<!-- App Bar -->
<AppBar>
	{#snippet lead()}
		<strong class="text-xl uppercase">Skeleton</strong>
	{/snippet}
	{#snippet trail()}
		<a
			class="btn btn-sm variant-ghost-surface"
			href="https://discord.gg/EXqV7W8MtY"
			target="_blank"
			rel="noreferrer"
		>
			Discord
		</a>
		<a
			class="btn btn-sm variant-ghost-surface"
			href="https://twitter.com/SkeletonUI"
			target="_blank"
			rel="noreferrer"
		>
			Twitter
		</a>
		<a
			class="btn btn-sm variant-ghost-surface"
			href="https://github.com/skeletonlabs/skeleton"
			target="_blank"
			rel="noreferrer"
		>
			GitHub
		</a>
	{/snippet}
	{#snippet headline()}
		<h2 class="h2">Headline</h2>
	{/snippet}
</AppBar>
<!-- Page Route Content -->
{@render children()}
