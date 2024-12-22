<script lang="ts">
	import '../app.css';
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	let { children } = $props();
</script>

<!-- App Bar -->
<div class="sticky top-0">
	<AppBar>
		{#snippet lead()}
			<strong class="text-xl uppercase">NK</strong>
		{/snippet}
		{#snippet trail()}
			<a
				class="variant-ghost-surface btn btn-sm"
				href="https://discord.gg/EXqV7W8MtY"
				target="_blank"
				rel="noreferrer"
			>
				Discord
			</a>
			<a
				class="variant-ghost-surface btn btn-sm"
				href="https://twitter.com/SkeletonUI"
				target="_blank"
				rel="noreferrer"
			>
				Twitter
			</a>
			<a
				class="variant-ghost-surface btn btn-sm"
				href="https://github.com/skeletonlabs/skeleton"
				target="_blank"
				rel="noreferrer"
			>
				GitHub
			</a>
		{/snippet}
		<!--
		{#snippet headline()}
			<h2 class="h2">Headline</h2>
		{/snippet}
		-->
	</AppBar>
</div>
<!-- Page Route Content -->
<main>
	{@render children()}
</main>
