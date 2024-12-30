<script lang="ts">
	import { page } from '$app/stores';
	let url = $page.url.host;
	url = 'https://' + url;
</script>

<div class="flex h-screen w-screen flex-col items-center justify-center gap-8">
	<h1 class="text-4xl">No persistent storage (indexeddb)</h1>
	<p>
		On Chrome open chrome://settings/content/siteData and either allow all web sites or just {url}
	</p>
</div>
