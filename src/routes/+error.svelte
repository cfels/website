<script>
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	const faces = {
		404: '>_<',
		403: '•_•',
		500: 'x_x',
		default: '@_@'
	};

	const face = $derived(faces[page.status] ?? faces.default);
	const message = $derived(
		!page.error?.message || page.error.message === 'Not Found'
			? "i don't think that page exists!"
			: page.error.message
	);

	onMount(() => {
		const prevHtml = document.documentElement.style.overflow;
		const prevBody = document.body.style.overflow;
		document.documentElement.style.overflow = 'hidden';
		document.body.style.overflow = 'hidden';

		return () => {
			document.documentElement.style.overflow = prevHtml;
			document.body.style.overflow = prevBody;
		};
	});
</script>

<div class="error-page">
	<div class="face">{face}</div>
	<p class="message">{message}</p>
	<a href="/" class="home-link">← back home</a>
</div>

<style>
	.error-page {
		height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: 0.75rem;
		background: #11111b;
		color: #cdd6f4;
		font-family: monospace;
		text-align: center;
		padding: 1rem;
		padding-top: 6vh;
		box-sizing: border-box;
		overflow: hidden;
	}

	.face {
		font-size: 3rem;
		font-weight: bold;
		letter-spacing: 0.1em;
		color: #cba6f7;
	}

	.message {
		font-size: 1rem;
		color: #cdd6f4;
		margin: 0;
	}

	.home-link {
		margin-top: 1rem;
		color: #cba6f7;
		text-decoration: none;
		font-size: 0.9rem;
		border-bottom: 1px dashed transparent;
		transition: color 0.2s ease, border-color 0.2s ease;
	}

	.home-link:hover {
		color: #fad6ff;
		border-color: #fad6ff;
	}
</style>
