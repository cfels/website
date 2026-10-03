<script lang="ts">
	import { reveal } from '$lib/reveal';
</script>

<svelte:head>
	<link
		rel="stylesheet"
		href="https://cdn.jsdelivr.net/npm/@fontsource/iosevka@5.3.0/index.css"
	/>
</svelte:head>

<div class="uma-content">
	<div class="uma-card intro reveal" use:reveal>
		<p class="hiii">Hai :3</p>
		<p>I'm not struggling with money, but I would totally appreciate it if you'd donate &lt;3</p>
	</div>

	<h2 class="uma-section reveal" id="addresses" use:reveal><span>My Crypto Addresses</span><i></i></h2>
	<div class="uma-card list reveal" use:reveal={70}>
		<div class="uma-tile crypto">
			<span class="uma-tile-ico ic-xmr">
				<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true">
					<path d="M0 0h24v24H0z" fill="none" />
					<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 18h3V7l6 7l6-7v11h3" />
				</svg>
			</span>
			<span class="crypto-body">
				<span class="coin">Monero</span>
				<code class="addr">42RNwVW9cLwVzcKc5eDwmwcS3NE6KwnkNf2uNk8FPt4a7YePCBXR7BvKs5bRq2ozZ3aFsrxaULuMAdKrgUyQ5LwhQELDwwX</code>
			</span>
		</div>
		<div class="uma-tile crypto">
			<span class="uma-tile-ico ic-bsc">
				<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true">
					<path d="M0 0h24v24H0z" fill="none" />
					<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 19H9.806a2 2 0 0 1-1.98-2.283L9.5 5M14 9l-9 4" />
				</svg>
			</span>
			<span class="crypto-body">
				<span class="coin">BSC</span>
				<code class="addr">0x54Ab925fAa462C40d35Ba2dc00F073E401aC20E5</code>
			</span>
		</div>
		<div class="uma-tile crypto">
			<span class="uma-tile-ico ic-ton">
				<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true">
					<path d="M0 0h24v24H0z" fill="none" />
					<path fill="currentColor" d="m20.661 7.22l-7.846 12.494a1.06 1.06 0 0 1-1.794-.006L3.328 7.214A2.2 2.2 0 0 1 3 6.05a2.29 2.29 0 0 1 2.324-2.255h13.362C19.963 3.794 21 4.8 21 6.044c0 .413-.116.82-.339 1.175M5.218 6.8l5.723 8.826V5.912H5.816c-.592 0-.857.392-.598.89m7.84 8.826L18.783 6.8c.265-.497-.006-.89-.599-.89H13.06z" />
				</svg>
			</span>
			<span class="crypto-body">
				<span class="coin">Toncoin</span>
				<code class="addr">UQDC7-Fnup560oTWeH8P12lbdYs_DDLoo4wZLIh_xubqEigK</code>
			</span>
		</div>
	</div>
</div>

<style>
	.hiii {
		font-size: 1.28rem;
		font-weight: 800;
		color: var(--green-d);
	}
	.intro {
		padding: 14px 16px;
	}

	.crypto {
		align-items: flex-start;
	}
	.uma-tile-ico {
		font-size: 18px;
	}
	.ic-xmr {
		background: linear-gradient(180deg, #ff9a5c, #f2681c);
	}
	.ic-bsc {
		background: linear-gradient(180deg, #f7d76a, #e0a80f);
		color: #523c00;
	}
	.ic-ton {
		background: linear-gradient(180deg, #7fd4ee, #2fa3d8);
	}
	.crypto-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.coin {
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}
	.addr {
		font-family: 'Iosevka', monospace;
		font-size: 0.82rem;
		line-height: 1.35;
		color: var(--ink);
		word-break: break-all;
	}
</style>
