<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { mascots, tracks } from '$lib/music';
	import MusicIcon from '~icons/mingcute/music-2-line';
	import PlayIcon from '~icons/mingcute/play-fill';
	import PauseIcon from '~icons/mingcute/pause-fill';
	import PreviousIcon from '~icons/mingcute/skip-previous-fill';
	import NextIcon from '~icons/mingcute/skip-forward-fill';
	import ShuffleIcon from '~icons/mingcute/shuffle-fill';
	import RepeatIcon from '~icons/mingcute/repeat-fill';
	import RepeatOneIcon from '~icons/mingcute/repeat-one-fill';
	import VolumeIcon from '~icons/mingcute/volume-fill';
	import VolumeMuteIcon from '~icons/mingcute/volume-mute-fill';
	import PlaylistIcon from '~icons/mingcute/playlist-fill';
	import CloseIcon from '~icons/mingcute/close-fill';

	type RepeatMode = 'off' | 'all' | 'one';
	type SavedState = {
		index?: number;
		volume?: number;
		muted?: boolean;
		shuffle?: boolean;
		repeat?: RepeatMode;
		mascot?: number;
	};

	const storageKey = 'uma-player-state';

	let audio = $state<HTMLAudioElement | null>(null);
	let index = $state(0);
	let mascot = $state(0);
	let playing = $state(false);
	let elapsed = $state(0);
	let duration = $state(0);
	let volume = $state(0.7);
	let muted = $state(false);
	let shuffle = $state(false);
	let repeat = $state<RepeatMode>('off');
	let listOpen = $state(false);
	let restored = $state(false);
	let failed = $state(false);

	const track = $derived(tracks[index] ?? null);
	const mascotSrc = $derived(mascots.length ? mascots[((mascot % mascots.length) + mascots.length) % mascots.length] : null);
	const progress = $derived(duration > 0 ? Math.min(elapsed / duration, 1) : 0);
	const hasTracks = $derived(tracks.length > 0);
	const canShuffle = $derived(tracks.length > 1);

	function formatTime(seconds: number): string {
		if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
		const total = Math.floor(seconds);
		const minutes = Math.floor(total / 60);
		return `${minutes}:${String(total % 60).padStart(2, '0')}`;
	}

	function play(): void {
		const element = audio;
		if (!element || !hasTracks) return;
		const started = element.play();
		if (started) started.catch(() => (playing = false));
	}

	function toggle(): void {
		if (!audio || !hasTracks) return;
		if (playing) audio.pause();
		else play();
	}

	function load(position: number, autoplay: boolean): void {
		if (!tracks.length) return;
		const element = audio;
		const wrapped = ((position % tracks.length) + tracks.length) % tracks.length;
		index = wrapped;
		elapsed = 0;
		duration = 0;
		failed = false;
		if (!element) return;
		element.src = tracks[wrapped].url;
		element.load();
		if (autoplay) play();
	}

	function upcoming(): number {
		if (shuffle && tracks.length > 1) {
			let candidate = index;
			while (candidate === index) candidate = Math.floor(Math.random() * tracks.length);
			return candidate;
		}
		if (index + 1 < tracks.length) return index + 1;
		return repeat === 'all' ? 0 : -1;
	}

	function step(direction: number): void {
		if (direction > 0) {
			const next = upcoming();
			load(next === -1 ? 0 : next, true);
			return;
		}
		load(index - 1, true);
	}

	function handleEnded(): void {
		if (repeat === 'one') {
			const element = audio;
			if (!element) return;
			element.currentTime = 0;
			play();
			return;
		}
		const next = upcoming();
		if (next === -1) {
			const element = audio;
			playing = false;
			elapsed = 0;
			if (element) element.currentTime = 0;
			return;
		}
		load(next, true);
	}

	function cycleRepeat(): void {
		repeat = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off';
	}

	function toggleMute(): void {
		muted = !muted;
	}

	function cycleMascot(): void {
		if (!mascots.length) return;
		mascot = (mascot + 1) % mascots.length;
	}

	function mascotName(url: string): string {
		const file = url.split('/').pop() ?? url;
		return file
			.replace(/\.[^.]+$/, '')
			.split('.')[0]
			.replace(/[-_]+/g, ' ');
	}

	function seek(event: Event): void {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		elapsed = value;
		if (audio) audio.currentTime = value;
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') listOpen = false;
	}

	$effect(() => {
		if (!audio) return;
		audio.volume = volume;
		audio.muted = muted;
	});

	$effect(() => {
		if (!browser || !restored) return;
		const payload: SavedState = { index, volume, muted, shuffle, repeat, mascot };
		localStorage.setItem(storageKey, JSON.stringify(payload));
	});

	$effect(() => {
		const current = track;
		if (!browser || !restored || !current) return;
		if (!('mediaSession' in navigator)) return;
		const image = mascotSrc;
		if (typeof MediaMetadata === 'undefined') return;
		navigator.mediaSession.metadata = new MediaMetadata({
			title: current.title,
			artist: current.artist || 'umamusume',
			album: current.album,
			artwork: image ? [{ src: image, sizes: '132x132', type: 'image/gif' }] : []
		});
	});

	onMount(() => {
		if (browser) {
			try {
				const raw = localStorage.getItem(storageKey);
				if (raw) {
					const saved = JSON.parse(raw) as SavedState;
					if (typeof saved.volume === 'number') volume = Math.min(1, Math.max(0, saved.volume));
					if (typeof saved.muted === 'boolean') muted = saved.muted;
					if (typeof saved.shuffle === 'boolean') shuffle = saved.shuffle;
					if (saved.repeat === 'off' || saved.repeat === 'all' || saved.repeat === 'one') repeat = saved.repeat;
					if (typeof saved.index === 'number' && saved.index >= 0 && saved.index < tracks.length) index = saved.index;
					if (typeof saved.mascot === 'number' && saved.mascot >= 0) mascot = saved.mascot;
				}
			} catch {
				restored = true;
			}
		}
		const element = audio;
		if (element) {
			element.volume = volume;
			element.muted = muted;
			if (tracks.length) element.src = tracks[index].url;
		}
		if (browser && 'mediaSession' in navigator) {
			const handler = (action: 'play' | 'pause' | 'nexttrack' | 'previoustrack', run: () => void) => {
				try {
					navigator.mediaSession.setActionHandler(action, run);
				} catch {
					return;
				}
			};
			handler('play', () => play());
			handler('pause', () => audio?.pause());
			handler('nexttrack', () => step(1));
			handler('previoustrack', () => step(-1));
		}
		restored = true;
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="player" class:failed>
	<button
		type="button"
		class="stage"
		class:live={playing}
		onclick={cycleMascot}
		title="click me for another uma"
		aria-label="change dancing uma"
	>
		{#if mascotSrc}
			<img src={mascotSrc} alt="" />
		{:else}
			<span class="stage-empty"><MusicIcon width="28" height="28" /></span>
		{/if}
	</button>

	<div class="meta">
		<p class="eyebrow">
			{#if playing}
				<span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>
				now playing
			{:else}
				<span class="note" aria-hidden="true"><MusicIcon width="12" height="12" /></span>
				uma player
			{/if}
		</p>
		<p class="title" class:idle={!track}>
			{track ? track.title : hasTracks ? 'pick a track' : 'no tracks yet'}
		</p>
		<p class="sub">
			{#if failed}
				couldn't play that one, skipping
			{:else if track}
				{track.artist ? `${track.artist} · ` : ''}{track.album}
			{:else}
				add mp3 / flac / ogg files in assets/music
			{/if}
		</p>
		<div class="seek-row">
			<span class="time">{formatTime(elapsed)}</span>
			<input
				class="seek"
				type="range"
				min="0"
				max={duration > 0 ? duration : 1}
				step="0.05"
				value={elapsed}
				disabled={!hasTracks}
				style:--fill="{progress * 100}%"
				oninput={seek}
				aria-label="seek"
			/>
			<span class="time">{formatTime(duration)}</span>
		</div>
	</div>

	{#if mascots.length > 1}
		<div class="dancers" aria-label="uma dancers">
			{#each mascots as src, position (src)}
				<button
					type="button"
					class="dancer"
					class:on={position === mascot}
					style:animation-delay="-{position * 130}ms"
					onclick={() => (mascot = position)}
					title={`put ${mascotName(src)} on the player`}
					aria-label={`put ${mascotName(src)} on the player`}
				>
					<img {src} alt="" />
				</button>
			{/each}
		</div>
	{/if}

	<div class="controls">
		<div class="transport">
			<button
				type="button"
				class="ghost"
				class:active={shuffle && canShuffle}
				disabled={!canShuffle}
				onclick={() => (shuffle = !shuffle)}
				title="shuffle"
				aria-label="shuffle"
			>
				<ShuffleIcon width="17" height="17" />
			</button>
			<button type="button" class="ghost" disabled={!hasTracks} onclick={() => step(-1)} title="previous" aria-label="previous">
				<PreviousIcon width="19" height="19" />
			</button>
			<button
				type="button"
				class="main"
				disabled={!hasTracks}
				onclick={toggle}
				title={playing ? 'pause' : 'play'}
				aria-label={playing ? 'pause' : 'play'}
			>
				{#if playing}
					<PauseIcon width="20" height="20" />
				{:else}
					<PlayIcon width="20" height="20" />
				{/if}
			</button>
			<button type="button" class="ghost" disabled={!hasTracks} onclick={() => step(1)} title="next" aria-label="next">
				<NextIcon width="19" height="19" />
			</button>
			<button
				type="button"
				class="ghost"
				class:active={repeat !== 'off'}
				onclick={cycleRepeat}
				title={repeat === 'one' ? 'repeat one' : repeat === 'all' ? 'repeat all' : 'repeat off'}
				aria-label="repeat mode"
			>
				{#if repeat === 'one'}
					<RepeatOneIcon width="17" height="17" />
				{:else}
					<RepeatIcon width="17" height="17" />
				{/if}
			</button>
		</div>
		<div class="utilities">
			<button type="button" class="ghost small" onclick={toggleMute} title={muted ? 'unmute' : 'mute'} aria-label="mute">
				{#if muted || volume === 0}
					<VolumeMuteIcon width="16" height="16" />
				{:else}
					<VolumeIcon width="16" height="16" />
				{/if}
			</button>
			<input
				class="volume"
				type="range"
				min="0"
				max="1"
				step="0.01"
				bind:value={volume}
				style:--fill="{muted ? 0 : volume * 100}%"
				aria-label="volume"
			/>
			<button
				type="button"
				class="ghost small"
				class:active={listOpen}
				disabled={!hasTracks}
				onclick={() => (listOpen = !listOpen)}
				title="playlist"
				aria-label="playlist"
			>
				<PlaylistIcon width="16" height="16" />
			</button>
		</div>
	</div>
	{#if listOpen && hasTracks}
		<div class="sheet">
		<div class="sheet-head">
			<span>{tracks.length} tracks in the stable</span>
			<button type="button" class="ghost small" onclick={() => (listOpen = false)} aria-label="close playlist">
				<CloseIcon width="16" height="16" />
			</button>
		</div>
		<ul>
			{#each tracks as item, position (item.id)}
				<li>
					<button
						type="button"
						class="row"
						class:current={position === index}
						class:on={position === index && playing}
						onclick={() => {
							load(position, true);
							listOpen = false;
						}}
					>
						<span class="row-index">
							{#if position === index && playing}
								<span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>
							{:else}
								{String(position + 1).padStart(2, '0')}
							{/if}
						</span>
						<span class="row-text">
							<span class="row-title">{item.title}</span>
							<span class="row-sub">{item.artist ? item.artist : item.album}</span>
						</span>
					</button>
				</li>
			{/each}
		</ul>
		</div>
	{/if}
</div>

{#if listOpen && hasTracks}
	<button type="button" class="scrim" onclick={() => (listOpen = false)} aria-label="close playlist"></button>
{/if}

<audio
	bind:this={audio}
	preload="metadata"
	onplay={() => (playing = true)}
	onpause={() => (playing = false)}
	onended={handleEnded}
	onloadedmetadata={() => (duration = audio?.duration ?? 0)}
	ondurationchange={() => (duration = audio?.duration ?? 0)}
	ontimeupdate={() => (elapsed = audio?.currentTime ?? 0)}
	onerror={() => {
		failed = true;
		playing = false;
	}}
></audio>

<style>
	:global(body) {
		padding-bottom: 9rem;
	}

	.player {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		width: 100%;
		z-index: 60;
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.8rem max(1.15rem, calc((100vw - 1400px) / 2)) 0.9rem;
		box-sizing: border-box;
		background: linear-gradient(180deg, rgba(30, 30, 46, 0.96), rgba(17, 17, 27, 0.99));
		border-top: 1px solid rgba(245, 194, 231, 0.2);
		box-shadow:
			0 -16px 44px rgba(0, 0, 0, 0.55),
			0 1px 0 rgba(250, 214, 255, 0.08) inset;
		backdrop-filter: blur(14px);
		text-align: left;
		animation: dock-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.stage {
		position: relative;
		flex: 0 0 auto;
		width: 78px;
		height: 78px;
		padding: 0;
		border-radius: 16px;
		border: 1px solid rgba(245, 194, 231, 0.45);
		background: #ffffff;
		overflow: hidden;
		display: grid;
		place-items: center;
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45);
		transition:
			border-color 0.3s ease,
			box-shadow 0.3s ease,
			transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.stage:hover {
		transform: translateY(-2px);
	}

	.stage.live {
		border-color: #fad6ff;
		box-shadow:
			0 0 24px rgba(245, 194, 231, 0.45),
			0 8px 20px rgba(0, 0, 0, 0.45);
	}

	.stage img {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: cover;
		filter: saturate(0.25) brightness(0.94);
		opacity: 0.85;
		transition:
			filter 0.4s ease,
			opacity 0.4s ease;
	}

	.stage.live img {
		filter: none;
		opacity: 1;
	}

	.stage-empty {
		color: #f5c2e7;
		display: grid;
		place-items: center;
	}

	.dancers {
		flex: 0 0 auto;
		display: flex;
		align-items: flex-end;
		gap: 0.1rem;
		margin-left: auto;
		padding-bottom: 2px;
	}

	.dancer {
		width: 50px;
		height: 50px;
		padding: 0;
		border: none;
		border-radius: 12px;
		background: transparent;
		opacity: 0.62;
		filter: saturate(0.85);
		animation: dance 1.15s ease-in-out infinite;
		transition:
			opacity 0.25s ease,
			filter 0.25s ease,
			background-color 0.25s ease;
	}

	.dancer img {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: contain;
	}

	.dancer:hover {
		opacity: 1;
		filter: none;
	}

	.dancer.on {
		opacity: 1;
		filter: none;
		background: rgba(245, 194, 231, 0.14);
		box-shadow: 0 0 18px rgba(245, 194, 231, 0.28);
	}

	.meta {
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.12rem;
	}

	.eyebrow {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0;
		color: #f5c2e7;
		font-size: 0.6rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.note {
		display: inline-grid;
		place-items: center;
		color: #f5c2e7;
	}

	.bars {
		display: inline-flex;
		align-items: flex-end;
		gap: 2px;
		height: 10px;
	}

	.bars i {
		width: 2.5px;
		height: 100%;
		border-radius: 2px;
		background: linear-gradient(180deg, #fad6ff, #f5c2e7);
		transform-origin: bottom;
		animation: bars 900ms ease-in-out infinite;
	}

	.bars i:nth-child(1) {
		animation-delay: 0ms;
	}

	.bars i:nth-child(2) {
		animation-delay: 150ms;
	}

	.bars i:nth-child(3) {
		animation-delay: 300ms;
	}

	.title {
		margin: 0;
		color: #cdd6f4;
		font-size: 0.98rem;
		font-weight: 600;
		line-height: 1.3;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.title.idle {
		color: #6c7086;
		font-weight: 500;
	}

	.sub {
		margin: 0;
		color: #7f849c;
		font-size: 0.72rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.seek-row {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		margin-top: 0.4rem;
	}

	.time {
		color: #6c7086;
		font-size: 0.66rem;
		font-variant-numeric: tabular-nums;
		min-width: 2rem;
	}

	.seek {
		flex: 1 1 auto;
		height: 14px;
		width: 100%;
	}

	input[type='range'] {
		appearance: none;
		-webkit-appearance: none;
		margin: 0;
		background: transparent;
	}

	input[type='range']:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.seek::-webkit-slider-runnable-track {
		height: 6px;
		border-radius: 999px;
		background: linear-gradient(
			90deg,
			#f5c2e7 0%,
			#fad6ff var(--fill),
			rgba(108, 112, 134, 0.28) var(--fill),
			rgba(108, 112, 134, 0.28) 100%
		);
	}

	.seek::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 13px;
		height: 13px;
		margin-top: -3.5px;
		border-radius: 50%;
		background: #ffffff;
		border: 2px solid #f5c2e7;
		box-shadow: 0 0 8px rgba(245, 194, 231, 0.6);
		transition: transform 0.2s ease;
	}

	.seek:hover::-webkit-slider-thumb {
		transform: scale(1.15);
	}

	.seek::-moz-range-track {
		height: 6px;
		border-radius: 999px;
		background: rgba(108, 112, 134, 0.28);
	}

	.seek::-moz-range-progress {
		height: 6px;
		border-radius: 999px;
		background: linear-gradient(90deg, #f5c2e7, #fad6ff);
	}

	.seek::-moz-range-thumb {
		width: 11px;
		height: 11px;
		border: 2px solid #f5c2e7;
		border-radius: 50%;
		background: #ffffff;
	}

	.controls {
		flex: 0 0 auto;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.35rem;
	}

	.transport,
	.utilities {
		display: flex;
		align-items: center;
		gap: 0.28rem;
	}

	.ghost {
		width: 30px;
		height: 30px;
		padding: 0;
		display: grid;
		place-items: center;
		border: 1px solid transparent;
		border-radius: 50%;
		background: transparent;
		color: #7f849c;
		transition:
			color 0.2s ease,
			background-color 0.2s ease;
	}

	.ghost.small {
		width: 26px;
		height: 26px;
	}

	.ghost:hover:not(:disabled) {
		color: #fad6ff;
		background: rgba(245, 194, 231, 0.12);
	}

	.ghost.active {
		color: #f5c2e7;
	}

	.ghost:disabled {
		opacity: 0.32;
	}

	.main {
		width: 38px;
		height: 38px;
		padding: 0;
		display: grid;
		place-items: center;
		border: none;
		border-radius: 50%;
		color: #11111b;
		background: linear-gradient(160deg, #fad6ff, #f5c2e7);
		box-shadow: 0 4px 16px rgba(245, 194, 231, 0.35);
		transition:
			transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
			box-shadow 0.18s ease;
	}

	.main:hover:not(:disabled) {
		transform: scale(1.07);
		box-shadow: 0 6px 20px rgba(245, 194, 231, 0.5);
	}

	.main:disabled {
		opacity: 0.4;
	}

	.volume {
		width: 72px;
		height: 12px;
	}

	.volume::-webkit-slider-runnable-track {
		height: 4px;
		border-radius: 999px;
		background: linear-gradient(
			90deg,
			#f5c2e7 0%,
			#fad6ff var(--fill),
			rgba(108, 112, 134, 0.28) var(--fill),
			rgba(108, 112, 134, 0.28) 100%
		);
	}

	.volume::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 10px;
		height: 10px;
		margin-top: -3px;
		border-radius: 50%;
		background: #ffffff;
		border: 2px solid #f5c2e7;
	}

	.volume::-moz-range-track {
		height: 4px;
		border-radius: 999px;
		background: rgba(108, 112, 134, 0.28);
	}

	.volume::-moz-range-progress {
		height: 4px;
		border-radius: 999px;
		background: linear-gradient(90deg, #f5c2e7, #fad6ff);
	}

	.volume::-moz-range-thumb {
		width: 9px;
		height: 9px;
		border: 2px solid #f5c2e7;
		border-radius: 50%;
		background: #ffffff;
	}

	.scrim {
		position: fixed;
		inset: 0;
		z-index: 55;
		padding: 0;
		border: none;
		background: rgba(17, 17, 27, 0.6);
		backdrop-filter: blur(2px);
	}

	.sheet {
		position: absolute;
		right: max(1.15rem, calc((100vw - 1400px) / 2));
		bottom: calc(100% + 0.6rem);
		width: min(420px, calc(100% - 1.5rem));
		max-height: 52vh;
		display: flex;
		flex-direction: column;
		border-radius: 16px;
		border: 1px solid rgba(245, 194, 231, 0.22);
		background: linear-gradient(180deg, rgba(30, 30, 46, 0.98), rgba(24, 24, 37, 0.99));
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(14px);
		overflow: hidden;
		text-align: left;
		animation: sheet-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.sheet-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.6rem 0.6rem 0.6rem 0.9rem;
		border-bottom: 1px solid rgba(108, 112, 134, 0.25);
		color: #f5c2e7;
		font-size: 0.66rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.sheet ul {
		margin: 0;
		padding: 0.35rem;
		list-style: none;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.row {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.4rem 0.5rem;
		border: none;
		border-radius: 10px;
		background: transparent;
		text-align: left;
		color: #cdd6f4;
		transition: background-color 0.2s ease;
	}

	.row:hover {
		background: rgba(245, 194, 231, 0.1);
	}

	.row.current {
		background: rgba(245, 194, 231, 0.16);
	}

	.row-index {
		flex: 0 0 auto;
		width: 1.7rem;
		display: inline-flex;
		align-items: center;
		color: #6c7086;
		font-size: 0.68rem;
		font-variant-numeric: tabular-nums;
	}

	.row.on .row-index {
		color: #f5c2e7;
	}

	.row-text {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.row-title {
		font-size: 0.82rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.row.on .row-title {
		color: #fad6ff;
	}

	.row-sub {
		color: #6c7086;
		font-size: 0.68rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@keyframes bars {
		0%,
		100% {
			transform: scaleY(0.45);
		}
		50% {
			transform: scaleY(1);
		}
	}

	@keyframes dance {
		0%,
		100% {
			transform: translateY(1px);
		}
		50% {
			transform: translateY(-4px);
		}
	}

	@keyframes dock-rise {
		from {
			transform: translateY(100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	@keyframes sheet-in {
		from {
			transform: translateY(14px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	@media (max-width: 1180px) {
		.dancers {
			display: none;
		}
	}

	@media (max-width: 720px) {
		:global(body) {
			padding-bottom: 8.5rem;
		}

		.player {
			gap: 0.7rem;
			padding: 0.7rem 0.8rem 0.8rem;
		}

		.stage {
			width: 64px;
			height: 64px;
			border-radius: 14px;
		}

		.title {
			font-size: 0.9rem;
		}

		.volume {
			display: none;
		}

		.ghost {
			width: 28px;
			height: 28px;
		}

		.main {
			width: 34px;
			height: 34px;
		}
	}

	@media (max-width: 460px) {
		.sub {
			display: none;
		}

		.eyebrow {
			font-size: 0.55rem;
			letter-spacing: 0.12em;
		}

		.time {
			min-width: 1.6rem;
		}

		.sheet {
			right: 0.8rem;
			left: 0.8rem;
			width: auto;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.player,
		.sheet,
		.bars i,
		.dancer {
			animation: none;
		}

		.stage:hover,
		.main:hover:not(:disabled) {
			transform: none;
		}
	}
</style>
