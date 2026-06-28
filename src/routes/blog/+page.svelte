<script lang="ts">
	let { data } = $props();
	let showPost = $state(false);
	let cmd = $state('');
	function handleKey(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			if (cmd.trim() === 'post.yes.yesssir') showPost = true;
			cmd = '';
		}
	}
</script>
<div class="content">
	{#each data.posts as post}
		<a href="/blog/{post.slug}" class="post">
			<p class="title">{post.title}</p>
			<p class="meta">{post.date}</p>
		</a>
		<hr>
	{/each}
	{#if data.posts.length === 0}
		<p class="empty">// no posts yet</p>
	{/if}
	{#if showPost}
		<br>
		<a href="/blog/new" class="post-btn">+ new post</a>
	{/if}
	<div class="console">
		<span class="prompt">&gt;</span>
		<input type="text" bind:value={cmd} onkeydown={handleKey} placeholder="..." spellcheck="false" autocomplete="off" />
	</div>
</div>
<style>
	.content { text-align: left; max-width: 600px; margin: 0 auto; padding: 0 1rem; box-sizing: border-box; }
	p { font-size: 1rem; color: #cdd6f4; }
	.post { display: block; text-decoration: none; margin-bottom: 0.5rem; }
	.title { color: #cba6f7; font-size: 1.1rem; font-weight: 600; margin: 0; }
	.title:hover { text-decoration: underline; }
	.meta { color: #6c7086; font-size: 0.9rem; margin: 0.1rem 0 0 0; }
	hr { border: none; border-top: 0.5px solid #313244; margin: 0.75rem 0; }
	.empty { color: #6c7086; }
	.post-btn {
		display: inline-block;
		color: #a6e3a1;
		border: 0.5px solid #a6e3a1;
		padding: 0.2rem 0.6rem;
		font-size: 0.9rem;
		text-decoration: none;
		margin-bottom: 1rem;
	}
	.post-btn:hover { background: #a6e3a122; }
	.console { display: flex; align-items: center; gap: 0.4rem; margin-top: 2rem; opacity: 0.3; }
	.console:focus-within { opacity: 1; }
	.prompt { color: #6c7086; }
	.console input {
		background: transparent;
		border: none;
		outline: none;
		color: #cdd6f4;
		font-family: inherit;
		font-size: 0.9rem;
		width: 200px;
		caret-color: #f5c2e7;
	}
</style>
