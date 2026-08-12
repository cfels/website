<script lang="ts">
	import { onMount } from 'svelte';
	import 'spoilerjs/spoiler-span';
	import anybrowserPng from '$lib/assets/any-browser.png';
	import anybrowserRuPng from '$lib/assets/any-browser-ru.png';
	import containsJsPng from '$lib/assets/js.png';
	import piracyPng from '$lib/assets/piracy.png';
	import YourAdPng from '$lib/assets/your-ad-here.png';
	import madewithnvimPng from '$lib/assets/madewithnvim.png';
	import seedtorrentsGif from '$lib/assets/seedyourtorrents.gif';
	import moxiusbuttonPng from '$lib/assets/moxius_button.png';
	import teibuttonPng from '$lib/assets/teidesu.png';
	import MusicIcon from '~icons/mingcute/music-2-line';
	import TvIcon from '~icons/mingcute/tv-2-line';
	import BrushIcon from '~icons/mingcute/paint-brush-line';
	import CakeIcon from '~icons/mingcute/cake-line';
	import TranslateIcon from '~icons/mingcute/translate-2-line';
	import PhoneIcon from '~icons/mingcute/phone-line';
	import DiscordIcon from '~icons/mingcute/discord-line';
	import TelegramIcon from '~icons/mingcute/telegram-line';
	import MastodonIcon from '~icons/mingcute/mastodon-line';
	import MailIcon from '~icons/mingcute/mail-line';

	const atVariants  = ['|at|', '[@]', '(at)', '{@}', '[at]', '(@)', '<at>'];
	const dotVariants = ['|dot|', '[.]', '(dot)', '{.}', '[dot]', '(.)', '<dot>'];

	function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

	const emailDisplay = `moxiix ${pick(atVariants)} proton ${pick(dotVariants)} com`;

	let mounted = $state(false);
	onMount(() => {
		const ready = 'fonts' in document ? document.fonts.ready : Promise.resolve();
		ready.then(() => {
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					mounted = true;
				});
			});
		});
	});

	let planeState = $state<'idle' | 'playing'>('idle');

	function planeEnter() {
		if (planeState === 'idle') planeState = 'playing';
	}
	function planeAnimEnd() {
		planeState = 'idle';
	}
</script>

<div class="content">
	<p class="hiii">haiii~</p>
	<p>i'm <strong>moxiu</strong>, part time catgirl.</p>
	<p>also what do i do? well i mainly fuck around with linux and windows, also i try to do some game dev.</p> <br>
	<p>ps. dualbooting sucks (my opinion) </p>
	<p>
	<br>
		all my project's and stuff are on
		<a href="https://github.com/cfels" target="_blank">github</a>
	</p>
	<br>
	<p class="section">interesting info (not really):</p>
	<div class="about">
		<div class="row"><span class="label"><MusicIcon width="16" height="16" /> fav music</span><span class="value">rap, hip-hop, etc. (idc abt genre if it's good i listen to it)</span></div>
		<div class="row"><span class="label"><TvIcon width="16" height="16" /> fav anime</span><span class="value"><a href="https://anilist.co/anime/175977/My-Deer-Friend-Nokotan/" target="_blank">しかのこのこのここしたんたん</a></span></div>
		<div class="row"><span class="label"><BrushIcon width="16" height="16" /> fav color</span><span class="value"><span class="dot"></span>#fad6ff</span></div>
		<div class="row"><span class="label"><CakeIcon width="16" height="16" /> birthday</span><span class="value">january 24 (15yo) [♒ Aquarius]</span></div>
		<div class="row"><span class="label"><TranslateIcon width="16" height="16" /> langs</span><span class="value"><img src="https://flagcdn.com/16x12/pl.png" alt="PL" width="16" height="12"> polish (native), <img src="https://flagcdn.com/16x12/gb.png" alt="GB" width="16" height="12"> c1</span></div>
	</div>
	<br>
	<p class="section">contact me:</p>
	<div class="about">
		<div class="row"><span class="label"><PhoneIcon width="16" height="16" /> phone</span><span class="value">nope :p</span></div>
		<div class="row discord-row"><span class="label"><DiscordIcon width="16" height="16" /> discord</span><span class="value"><a href="https://discord.com/users/1154823136710246441" target="_blank">@moxiiuu</a></span></div>
		<div
			class="row telegram-row"
			onmouseenter={planeEnter}
		>
			<span class="label">
				<span class="plane-hitbox">
					<span
						class="plane-wrap"
						class:plane-loop={planeState === 'playing'}
						onanimationend={planeAnimEnd}
					>
						<TelegramIcon width="16" height="16" />
					</span>
				</span>
				telegram
			</span>
			<span class="value"><a href="https://t.me/cfelz" target="_blank">t.me/cfelz</a></span>
		</div>
		<div class="row"><span class="label"><MastodonIcon width="16" height="16" /> fendi</span><span class="value"><a href="https://fendi.vacpro.fyi/moxiu" target="_blank">@moxiu</a></span></div>
		<div class="row email-row">
			<span class="label"><MailIcon width="16" height="16" /> email</span>
			<span class="value">
				{#if mounted}
					<spoiler-span reveal-duration="150" spawn-stop-delay="80">{emailDisplay}</spoiler-span>
				{:else}
					<span style="opacity:0">loading...</span>
				{/if}
			</span>
		</div>
	</div>
	<br>
	<p class="section">some cool button's:</p>
	<div class="buttons">
		<a href="https://www.qbittorrent.org/" target="_blank">
			<img src={seedtorrentsGif} alt="seed your torrent's!" height="31">
		</a>
		<a href="https://m5rcel.neocities.org" target="_blank">
		<img src="https://m5rcel.neocities.org/hardware_central.gif" width="88" height="31" alt="Woah Hardware Central" />
		</a>
		<a href="https://m5rcel.neocities.org" target="_blank">
		<img src="https://m5rcel.neocities.org/hatems.jpg" width="88" height="31" alt="#1 Microslop Hater" />
		</a>
		<a href="https://m5rcel.neocities.org" target="_blank">
		<img src="https://m5rcel.neocities.org/linuxnow.jpg" width="88" height="31" alt="Become a Linux user now!" />
		</a>
		<a href="https://moxiu.vacpro.fyi" target="_blank">
		<img src={moxiusbuttonPng}  width="88" height="31" alt="my button!" />
		</a>
		<a href="https://m5rcel.neocities.org" target="_blank">
		<img src="https://m5rcel.neocities.org/google_25wht.gif" width="88" height="31" alt="Googol." />
		</a>
		<a href="https://m5rcel.neocities.org" target="_blank">
		<img src="https://m5rcel.neocities.org/gmail.gif" width="88" height="31" alt="Gmail" />
		</a>
		<img src={piracyPng} width="88" height="31" alt="piracy now!" />
		<img src={containsJsPng} width="88" height="31" alt="page contain's js!" />
		<img src={anybrowserPng} width="88" height="31" alt="any browser!" />
		<img src={anybrowserRuPng} width="88" height="31" alt="any browser RU!" />
		<img src={madewithnvimPng} width="88" height="31" alt="made with nvim" />
		<a href="https://t.me/cfelz" target="_blank">
		<img src={YourAdPng}  width="88" height="31" alt="your ad" />
		</a>
	</div>
</div>

<style>
	.content { text-align: left; max-width: 600px; margin: 0 auto; padding: 0 1rem; box-sizing: border-box; }
	.hiii { font-size: 1.2rem; color: #cdd6f4; margin-bottom: 0.5rem; }
	p { font-size: 1rem; color: #cdd6f4; }
	strong { color: #f5c2e7; font-weight: 600; }
	.section { color: #f2cdcd; font-weight: 600; margin-bottom: 0.4rem; }
	.about { display: flex; flex-direction: column; gap: 0.2rem; }
	.row { display: flex; gap: 0.5rem; align-items: center; padding: 0.15rem 0.3rem; border-radius: 6px; transition: background-color 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
	.row:hover { background-color: rgba(203, 166, 247, 0.08); transform: translateX(2px); }
	.label { color: #6c7086; font-size: 0.95rem; min-width: 100px; flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.35rem; transition: color 0.25s ease; }
	.row:hover .label { color: #cba6f7; }
	.row:hover .label :global(svg) { transform: scale(1.15) rotate(-6deg); }
	.label :global(svg) { transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); flex-shrink: 0; }

	.discord-row .label :global(svg) {
		transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
	}
	.discord-row:hover .label :global(svg) {
		transform: rotate(360deg);
	}

	.plane-hitbox {
		position: relative;
		width: 16px;
		height: 16px;
		overflow: hidden;
		display: inline-block;
		flex-shrink: 0;
	}
	.plane-wrap {
		position: absolute;
		top: 0;
		left: 0;
		display: inline-flex;
	}
	.plane-wrap.plane-loop {
		animation: plane-loop-anim 0.9s cubic-bezier(0.45, 0, 0.55, 1) forwards;
	}
	@keyframes plane-loop-anim {
		0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
		38% { transform: translate(130%, -130%) rotate(-22deg); opacity: 0; }
		40% { transform: translate(-130%, 130%) rotate(22deg); opacity: 0; }
		100% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
	}

	.value { color: #cdd6f4; font-size: 0.95rem; word-break: break-word; min-width: 0; }
	.value img { vertical-align: middle; margin-right: 2px; }
	.value a { color: #cba6f7; text-decoration: none; }
	.value a:hover { color: #fad6ff; text-decoration: underline; }
	kbd {
		display: block;
		background: #1e1e2e;
		color: #babbf1;
		font-size: 0.85rem;
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
		border: 1px solid #313244;
		font-family: monospace;
		word-break: break-all;
		margin-top: 0.15rem;
	}
	.dot {
		display: inline-block;
		width: 11px; height: 11px;
		border-radius: 50%;
		background: #fad6ff;
		margin-right: 4px;
		vertical-align: middle;
		border: 0.5px solid #585b70;
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}
	.buttons img {
		display: block;
	}
	.badge-break {
		flex-basis: 100%;
		height: 0;
	}
</style>
