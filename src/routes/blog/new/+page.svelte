<script lang="ts">
	import { marked } from 'marked';
	import { onMount } from 'svelte';

	onMount(() => {
		import('spoilerjs/spoiler-span');
	});

	let password = $state('');
	let authed = $state(false);
	let wrongPass = $state(false);
	let title = $state('');
	let body = $state('');
	let submitted = $state(false);
	let error = $state('');

	function withSpoilers(html: string) {
		return html.replace(/\|\|([^|]+?)\|\|/g, (_, inner) => {
			const trimmed = inner.trim();
			if (/<img[\s>]/i.test(trimmed)) {
				return `<span class="spoiler-img">${trimmed}</span>`;
			}
			return `<spoiler-span>${trimmed}</spoiler-span>`;
		});
	}

	let renderedPreview = $derived(withSpoilers(marked(body) as string));

	async function checkPass() {
		const res = await fetch('/api/posts/check', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password })
		});
		if (res.ok) { authed = true; wrongPass = false; }
		else { wrongPass = true; }
	}

	async function submit() {
		if (!title.trim() || !body.trim()) { error = '// title and body required'; return; }
		const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
		const res = await fetch('/api/posts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ slug, title, body, password })
		});
		if (res.ok) { submitted = true; }
		else { const data = await res.json(); error = `// error: ${data.error ?? 'unknown'}`; }
	}
</script>
<div class="content">
	{#if submitted}
		<p class="ok">// post submitted! <a href="/blog">back to blog</a></p>
	{:else if !authed}
		<p class="section">password:</p>
		<br>
		<div class="row">
			<input type="password" bind:value={password} onkeydown={(e) => e.key === 'Enter' && checkPass()} placeholder="..." spellcheck="false" />
			<button onclick={checkPass}>ok</button>
		</div>
		{#if wrongPass}<p class="err">// wrong password</p>{/if}
	{:else}
		<div class="toolbar">
			<p class="section">new post</p>
			<button onclick={submit} class="submit">post</button>
		</div>
		<br>
		<input class="title-input" type="text" bind:value={title} placeholder="title" spellcheck="false" />
		<br><br>
		<div class="editor">
			<textarea bind:value={body} placeholder="write markdown here..." spellcheck="false"></textarea>
			<div class="preview">{@html renderedPreview}</div>
		</div>
		{#if error}<p class="err">{error}</p>{/if}
	{/if}
</div>
<style>
	.content { text-align: left; max-width: 1100px; margin: 0 auto; padding: 0 1rem; box-sizing: border-box; }
	p { font-size: 1rem; color: #cdd6f4; }
	.section { color: #f2cdcd; font-weight: 600; }
	.err { color: #f38ba8; font-size: 0.9rem; margin-top: 0.5rem; }
	.ok { color: #a6e3a1; }
	.toolbar { display: flex; align-items: center; justify-content: space-between; }
	.row { display: flex; gap: 0.5rem; align-items: center; }
	.row input {
		background: transparent;
		border: none;
		border-bottom: 0.5px solid #45475a;
		color: #cdd6f4;
		font-family: inherit;
		font-size: 1rem;
		padding: 0.2rem 0;
		outline: none;
		caret-color: #f5c2e7;
		width: 180px;
	}
	.row input:focus { border-bottom-color: #cba6f7; }
	.title-input {
		width: 100%;
		background: transparent;
		border: 0.5px solid #313244;
		color: #cdd6f4;
		font-family: inherit;
		font-size: 1rem;
		padding: 0.3rem 0.5rem;
		outline: none;
		caret-color: #f5c2e7;
		box-sizing: border-box;
	}
	.title-input:focus { border-color: #6c7086; }
	.editor {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		height: 70vh;
	}
	@media (max-width: 600px) {
		.editor { grid-template-columns: 1fr; height: auto; }
		.preview { min-height: 200px; }
	}
	textarea {
		background: transparent;
		border: 0.5px solid #313244;
		color: #cdd6f4;
		font-family: inherit;
		font-size: 0.95rem;
		padding: 0.5rem;
		outline: none;
		caret-color: #f5c2e7;
		resize: none;
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		line-height: 1.7;
	}
	textarea:focus { border-color: #6c7086; }
	.preview {
		border: 0.5px solid #313244;
		padding: 0.5rem 0.75rem;
		color: #cdd6f4;
		font-size: 0.95rem;
		line-height: 1.7;
		overflow-y: auto;
		overflow-x: hidden;
		text-align: left;
	}
	.preview :global(img) { max-width: 100%; height: auto; display: block; }
	.preview :global(h1), .preview :global(h2), .preview :global(h3) { color: #f5c2e7; margin: 0.5rem 0; }
	.preview :global(a) { color: #cba6f7; }
	.preview :global(code) { background: #1e1e2e; padding: 0.1rem 0.3rem; font-family: inherit; }
	.preview :global(pre) { background: #1e1e2e; padding: 0.5rem; overflow-x: auto; }
	.preview :global(blockquote) { border-left: 2px solid #6c7086; margin: 0; padding-left: 0.75rem; color: #6c7086; }
	.preview :global(spoiler-span) { --spoiler-particle-color: #cdd6f4; word-break: break-word; overflow-wrap: anywhere; display: inline-block; max-width: 100%; }
	.preview :global(.spoiler-img) {
		display: inline-block;
		cursor: pointer;
		max-width: 100%;
		line-height: 0;
		overflow: hidden;
	}
	.preview :global(.spoiler-img img) {
		display: block;
		max-width: 100%;
		height: auto;
		filter: blur(20px);
		transition: filter 0.5s ease;
		pointer-events: none;
		user-select: none;
	}
	.preview :global(.spoiler-img:hover img) {
		filter: blur(0px);
	}
	button {
		background: transparent;
		border: 0.5px solid #6c7086;
		color: #cdd6f4;
		font-family: inherit;
		font-size: 0.9rem;
		padding: 0.2rem 0.6rem;
		cursor: pointer;
	}
	button:hover { border-color: #cba6f7; color: #cba6f7; }
	.submit { border-color: #a6e3a1; color: #a6e3a1; }
	.submit:hover { background: #a6e3a122; }
</style>
