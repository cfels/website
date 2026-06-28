<script lang="ts">
	import favicon from '$lib/assets/favicon.png';
	import karin from '$lib/assets/karin.gif';
	let { children } = $props();
</script>
<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>
<div class="topnav">
	<img src={karin} alt="karin" class="karin" />
	<span class="links"><a href="/">moxiu</a> / <a href="/blog">blog</a> / <a href="/donate">donate</a></span>
	<img src={karin} alt="karin" class="karin flip" />
</div>
{@render children()}
<style>
	:global(body) {
		margin: 0;
		min-height: 100vh;
		background-color: #11111b;
		color: #cdd6f4;
		font-family: 'Iosevka Nerd Font', 'Iosevka', monospace;
		text-align: center;
		padding-top: 2rem;
	}
	:global(a) { color: #cba6f7; text-decoration: none; }
	:global(a:hover) { text-decoration: underline; }
	:global(p) { margin: 0; }
	.topnav {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		margin-bottom: 2rem;
	}
	.links { font-size: 1rem; color: #f5c2e7; }
	.links a { color: #f5c2e7; }
	.links a:hover { color: #fad6ff; text-decoration: none; }
	.karin {
		height: 48px;
		width: auto;
		image-rendering: pixelated;
	}
	.flip { transform: scaleX(-1); }
</style>
