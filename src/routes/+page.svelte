<script lang="ts">
	import type { Snippet } from 'svelte';
	interface Props {
		children: Snippet;
	}
	let { children, ...props }: Props = $props();
</script>

{@render children()}
