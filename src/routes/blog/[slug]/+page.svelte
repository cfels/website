<script lang="ts">
	import { marked } from 'marked';
	let { data } = $props();
	let rendered = $derived(marked(data.body) as string);
</script>
<div class="content">
	<h1>{data.title}</h1>
	<p class="date">{data.date}</p>
	<hr>
	<div class="body">{@html rendered}</div>
</div>
<style>
	.content { text-align: left; max-width: 600px; margin: 0 auto; padding: 0 1rem; box-sizing: border-box; }
	h1 { font-size: 1.3rem; color: #f5c2e7; margin: 0 0 0.25rem 0; font-weight: 600; }
	.date { color: #6c7086; font-size: 0.9rem; margin: 0; }
	hr { border: none; border-top: 0.5px solid #313244; margin: 0.75rem 0; }
	.body { color: #cdd6f4; font-size: 1rem; line-height: 1.8; }
	.body :global(img) { max-width: 100%; height: auto; display: block; }
	.body :global(h1), .body :global(h2), .body :global(h3) { color: #f5c2e7; margin: 1rem 0 0.4rem; }
	.body :global(a) { color: #cba6f7; }
	.body :global(code) { background: #1e1e2e; padding: 0.1rem 0.3rem; font-family: inherit; font-size: 0.9rem; }
	.body :global(pre) { background: #1e1e2e; padding: 0.75rem; overflow-x: auto; border: 0.5px solid #313244; }
	.body :global(blockquote) { border-left: 2px solid #6c7086; margin: 0; padding-left: 0.75rem; color: #6c7086; }
	.body :global(p) { margin: 0.5rem 0; }
</style>
