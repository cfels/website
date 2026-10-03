<script lang="ts">
	import { reveal } from '$lib/reveal';
</script>

<div class="uma-content">
	<div class="uma-card intro reveal" use:reveal>
		<p class="hiii">Hai :3</p>
		<p>I'm not struggling with money, but I would totally appreciate it if you'd donate &lt;3</p>
	</div>

	<h2 class="uma-section reveal" id="addresses" use:reveal><span>My Crypto Addresses</span><i></i></h2>
	<div class="uma-card list reveal" use:reveal={70}>
		<div class="uma-tile crypto">
			<span class="uma-tile-ico ic-xmr">xmr</span>
			<span class="crypto-body">
				<span class="coin">Monero</span>
				<code class="addr">42RNwVW9cLwVzcKc5eDwmwcS3NE6KwnkNf2uNk8FPt4a7YePCBXR7BvKs5bRq2ozZ3aFsrxaULuMAdKrgUyQ5LwhQELDwwX</code>
			</span>
		</div>
		<div class="uma-tile crypto">
			<span class="uma-tile-ico ic-bsc">bsc</span>
			<span class="crypto-body">
				<span class="coin">BSC</span>
				<code class="addr">0x54Ab925fAa462C40d35Ba2dc00F073E401aC20E5</code>
			</span>
		</div>
		<div class="uma-tile crypto">
			<span class="uma-tile-ico ic-ton">ton</span>
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
		font-size: 0.66rem;
		font-weight: 800;
		text-transform: uppercase;
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
