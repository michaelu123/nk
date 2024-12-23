<script>
	let { data } = $props();
	let dataS = $derived(JSON.stringify(data));
	// let dataS = JSON.stringify(data);
	let { blogid } = $derived(data);
	$inspect(blogid);
</script>

<h1>Blog {dataS}</h1>
<h2>Blogid {blogid}</h2>

<a href="/blog/lll">BLOG/lll</a>
