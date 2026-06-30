<script lang="ts">
	import { onMount } from 'svelte';
	import shitcordGif from '$lib/assets/shitcord.gif';
  import anybrowserPng from '$lib/assets/any-browser.png';
  import anybrowserRuPng from '$lib/assets/any-browser-ru.png'
  import containsJsPng from '$lib/assets/js.png'
  import piracyPng from '$lib/assets/piracy.png'
  import YourAdPng from '$lib/assets/your-ad-here.png'
  import seedtorrentsGif from '$lib/assets/seedyourtorrents.gif'
	let showPost = $state(false);
	let cmd = $state('');
	function handleKey(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			if (cmd.trim() === 'post.yes.yesssir') showPost = true;
			cmd = '';
		}
	}
	onMount(() => import('spoilerjs/spoiler-span'));
</script>

<div class="content">
	<p class="hiii">haiii~</p>
	<p>i'm <strong>moxiu</strong>, full time larper</p>
	<p>also what do i do? well whatever that come's to my mind, and i create it</p>
	<br>
	<p class="section">interesting info (not really):</p>
	<div class="about">
		<div class="row"><span class="label">fav music</span><span class="value">hardtekk, hardstyle, rap, hip-hop, nightcore</span></div>
		<div class="row"><span class="label">fav anime</span><span class="value"><a href="https://anilist.co/anime/175977/My-Deer-Friend-Nokotan/" target="_blank">しかのこのこのここしたんたん</a></span></div>
		<div class="row"><span class="label">fav color</span><span class="value"><span class="dot"></span>#fad6ff</span></div>
		<div class="row"><span class="label">birthday</span><span class="value">january 24 (15yo) (Aquarius ♒)</span></div>
		<div class="row"><span class="label">langs</span><span class="value"><img src="https://flagcdn.com/16x12/pl.png" alt="PL" width="16" height="12"> polish (native), <img src="https://flagcdn.com/16x12/gb.png" alt="GB" width="16" height="12"> c1</span></div>
	</div>
	<br>
	<p class="section">contact me:</p>
	<div class="about">
		<div class="row"><span class="label">github</span><span class="value"><a href="https://github.com/cfels" target="_blank">github.com/cfels</a></span></div>
		<div class="row"><span class="label">discord</span><span class="value">dildsong</span></div>
		<div class="row"><span class="label">telegram</span><span class="value"><a href="https://t.me/cfelz" target="_blank">t.me/cfelz</a></span></div>
		<div class="row email-row">
			<span class="label">email</span>
			<span class="value">
				<spoiler-span reveal-duration="150" spawn-stop-delay="80">moxiix |at| proton |dot| com</spoiler-span>
				<span class="pgp">
					if possible, please encrypt the email using pgp:
					<kbd>curl -sL https://moxiu.vacpro.fyi/moxikey.pgp | gpg --import</kbd>
					<a href="https://moxiu.vacpro.fyi/moxikey.pgp" target="_blank"></a>
				</span>
			</span>
		</div>
	</div>
	<br>
	<p class="section">some cool button's:</p>
	<div class="buttons">
		<a href="https://spyware.neocities.org/articles/discord" target="_blank">
			<img src={shitcordGif} alt="discord is spyware" height="31">
		</a>
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
    <img src={YourAdPng} width="88" height="31" alt="your ad" />
	</div>
</div>

<style>
	.content { text-align: left; max-width: 600px; margin: 0 auto; padding: 0 1rem; box-sizing: border-box; }
	.hiii { font-size: 1.2rem; color: #cdd6f4; margin-bottom: 0.5rem; }
	p { font-size: 1rem; color: #cdd6f4; }
	strong { color: #f5c2e7; font-weight: 600; }
	.section { color: #f2cdcd; font-weight: 600; margin-bottom: 0.4rem; }
	.about { display: flex; flex-direction: column; gap: 0.2rem; }
	.row { display: flex; gap: 0.5rem; align-items: baseline; }
	.label { color: #6c7086; font-size: 0.95rem; min-width: 80px; flex-shrink: 0; }
	.value { color: #cdd6f4; font-size: 0.95rem; word-break: break-word; min-width: 0; }
	.value img { vertical-align: middle; margin-right: 2px; }
	.value a { color: #cba6f7; text-decoration: none; }
	.value a:hover { color: #fad6ff; text-decoration: underline; }
	.pgp { display: block; color: #9399b2; font-size: 0.88rem; margin-top: 0.15rem; }
	.pgp-url { display: block; color: #6c7086; font-size: 0.82rem; margin-top: 0.15rem; font-family: monospace; }
	.pgp-url:hover { color: #cba6f7 !important; }
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
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}
	.badges img {
		display: block;
	}
	.badge-break {
		flex-basis: 100%;
		height: 0;
	}
</style>
