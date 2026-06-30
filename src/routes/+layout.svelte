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
<footer class="site-footer">
	<p>ヾ(＾∇＾) moxiu / last updated 2026-08-01 / <a href="https://github.com/cfels/website" target="_blank">source code</a></p>
</footer>
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
		flex-wrap: wrap;
		padding: 0 1rem;
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

	.site-footer {
		margin-top: 1.5rem;
		padding: 0.3rem 1rem 1.5rem;
		text-align: center;
		box-sizing: border-box;
	}
	.site-footer p:first-child {
		display: inline-block;
		border-top: 1.5px solid #313244;
		padding-top: 0.6rem;
		width: 595px;
		max-width: 100%;
		box-sizing: border-box;
	}
	.site-footer p {
		color: #6c7086;
		font-size: 0.85rem;
		margin: 0.15rem 0;
	}
	.site-footer a {
		color: #cba6f7;
		text-decoration: underline;
	}
	.site-footer a:hover {
		color: #fad6ff;
	}

	@media (max-width: 480px) {
		.site-footer p {
			font-size: 0.78rem;
		}
		.links {
			font-size: 0.9rem;
		}
	}
</style>
