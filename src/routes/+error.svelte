<script>
	import { page } from '$app/state';

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
</script>

<div class="uma-content error-page">
	<div class="card">
		<div class="face">{face}</div>
		<p class="message">{message}</p>
		<a href="/" class="home-link">← back home</a>
	</div>
</div>

<style>
	.error-page {
		align-items: center;
		text-align: center;
	}

	.card {
		width: 100%;
		max-width: 380px;
		margin: 10px auto;
		padding: 22px 18px 24px;
		background: #fffdf8;
		border: 2px solid var(--line);
		border-radius: 16px;
		box-shadow: 0 2px 0 rgba(190, 175, 146, 0.45), 0 14px 26px -18px rgba(90, 70, 40, 0.6);
	}

	.face {
		font-size: 3rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		color: var(--green-d);
	}

	.message {
		margin: 0.4rem 0 0;
		font-size: 1rem;
		font-weight: 700;
		color: var(--ink);
	}

	.home-link {
		display: inline-block;
		margin-top: 1.1rem;
		padding: 0.4rem 1.1rem;
		border-radius: 999px;
		background: linear-gradient(180deg, var(--green-l), var(--green-d));
		color: #fff;
		font-size: 0.9rem;
		font-weight: 800;
		text-decoration: none;
		border-bottom: 0;
		box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.4), 0 2px 0 rgba(74, 143, 32, 0.35);
		text-shadow: 0 1px 0 rgba(63, 120, 26, 0.5);
		transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.home-link:hover {
		transform: translateY(-2px) scale(1.03);
	}
</style>
