<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { backOut, cubicIn, cubicOut } from 'svelte/easing';
	import { page } from '$app/state';
	import '../app.css';
	import favicon from '$lib/assets/favicon.png';
	import caratPng from '$lib/assets/carat.png';
	import clickSound from '$lib/assets/click_ound.mp3';
	import Loading from '$lib/components/Loading.svelte';
	import umapyoiLogo from '$lib/assets/logo/umapyoi.png';
	import astonMachan from '$lib/assets/uma/aston-machan.gif';
	import daiwaScarlet from '$lib/assets/uma/daiwa-scarlet.gif';
	import haruUrara from '$lib/assets/uma/haru-urara.gif';
	import kitasanBlack from '$lib/assets/uma/kitasan-black.gif';
	import naritaTaishin from '$lib/assets/uma/narita-taishin.gif';
	import niceNature from '$lib/assets/uma/nice-nature.gif';
	import tachyon from '$lib/assets/uma/tachyon.gif';

	import '$lib/assets/fonts/momotrust.ttf';

	import HomeIcon from '~icons/mingcute/home-4-line';
	import ChatIcon from '~icons/mingcute/message-3-line';
	import GithubIcon from '~icons/mingcute/github-line';
	import GiftIcon from '~icons/mingcute/gift-line';

	const umas = [
		{ src: astonMachan, name: 'Aston Machan' },
		{ src: daiwaScarlet, name: 'Daiwa Scarlet' },
		{ src: haruUrara, name: 'Haru Urara' },
		{ src: kitasanBlack, name: 'Kitasan Black' },
		{ src: naritaTaishin, name: 'Narita Taishin' },
		{ src: niceNature, name: 'Nice Nature' },
		{ src: tachyon, name: 'Tachyon' }
	];

	const titles: Record<string, string> = {
		'/': 'Home',
		'/donate': 'Support'
	};

	const tabs = [
		{ icon: HomeIcon, label: 'Home', href: '/' },
		{ icon: ChatIcon, label: 'Yapping', href: 'https://x.com/moxiu_x', external: true },
		{ icon: GiftIcon, label: 'Donate', href: '/donate', badge: true }
	];

	const rail = [
		{ icon: GithubIcon, label: 'GitHub', href: 'https://github.com/cfels', external: true },
		{ icon: ChatIcon, label: 'Yapping', href: 'https://x.com/moxiu_x', external: true }
	];

	const curves = {
		gravity: { label: 'Gravity', value: 'cubic-bezier(0.45, 0, 0.72, 0.38)' },
		steady: { label: 'Steady', value: 'linear' },
		float: { label: 'Float', value: 'cubic-bezier(0.16, 0.84, 0.44, 1)' },
		smooth: { label: 'Smooth', value: 'cubic-bezier(0.4, 0, 0.2, 1)' }
	};

	type Curve = keyof typeof curves;

	const defaults = { speed: 1, amount: 14, drift: 1, spin: 1, curve: 'gravity' as Curve };

	let fxOpen = $state(false);
	let fxSpeed = $state(defaults.speed);
	let fxAmount = $state(defaults.amount);
	let fxDrift = $state(defaults.drift);
	let fxSpin = $state(defaults.spin);
	let fxCurve = $state<Curve>(defaults.curve);

	const fallers = $derived.by(() =>
		Array.from({ length: fxAmount }, (_, i) => {
			const dir = i % 2 ? 1 : -1;
			return {
				left: `${(i * 7.3 + 3) % 96}%`,
				delay: `${-((i * 0.83) % 8).toFixed(2)}s`,
				dur: `${((3.8 + (i % 4) * 1.05) / fxSpeed).toFixed(2)}s`,
				size: `${24 + (i % 4) * 6}px`,
				drift: `${dir * (30 + (i % 3) * 40) * fxDrift}px`,
				spin: `${dir * (160 + i * 22) * fxSpin}deg`,
				opacity: `${0.5 + (i % 4) * 0.12}`
			};
		})
	);

	function closeFx() {
		fxOpen = false;
	}

	function resetFx() {
		fxSpeed = defaults.speed;
		fxAmount = defaults.amount;
		fxDrift = defaults.drift;
		fxSpin = defaults.spin;
		fxCurve = defaults.curve;
	}

	let fxPos = $state({ x: 0, y: 0 });
	let dragging = $state(false);
	let dragOrigin = { px: 0, py: 0, ox: 0, oy: 0 };

	function startDrag(e: PointerEvent) {
		if ((e.target as HTMLElement).closest('.fx-x')) return;
		dragging = true;
		dragOrigin = { px: e.clientX, py: e.clientY, ox: fxPos.x, oy: fxPos.y };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function moveDrag(e: PointerEvent) {
		if (!dragging) return;
		fxPos = {
			x: dragOrigin.ox + (e.clientX - dragOrigin.px),
			y: dragOrigin.oy + (e.clientY - dragOrigin.py)
		};
	}

	function endDrag() {
		dragging = false;
	}

	function slowFaller(e: PointerEvent, rate: number) {
		for (const anim of (e.currentTarget as HTMLElement).getAnimations()) {
			if (typeof anim.updatePlaybackRate === 'function') anim.updatePlaybackRate(rate);
			else anim.playbackRate = rate;
		}
	}

	let { children } = $props();

	let panelBody: HTMLElement | undefined;
	let contentH = $state(0);
	let swapH = $state(0);
	let heightInit = false;

	$effect(() => {
		const h = contentH;
		if (!h || !panelBody) return;
		if (!heightInit) {
			heightInit = true;
			panelBody.style.transition = 'none';
			swapH = h;
			requestAnimationFrame(() => requestAnimationFrame(() => panelBody?.style.removeProperty('transition')));
			return;
		}
		swapH = h;
	});

	function popIn(_node: Element) {
		return {
			duration: 430,
			delay: 130,
			easing: backOut,
			css: (t: number) =>
				`opacity:${Math.min(1, t * 1.9)};transform:scale(${0.965 + 0.035 * t}) translateY(${(1 - t) * 10}px)`
		};
	}

	function popOut(_node: Element) {
		return {
			duration: 150,
			easing: cubicIn,
			css: (t: number) =>
				`position:absolute;left:0;right:0;top:0;opacity:${t};transform:scale(${0.99 + 0.01 * t}) translateY(${(t - 1) * 6}px)`
		};
	}

	function trackHeight(node: HTMLElement) {
		const report = () => {
			if (node.isConnected) contentH = node.offsetHeight;
		};
		report();
		requestAnimationFrame(report);
	}

	let leftUma = $state(0);
	let rightUma = $state(Math.floor(umas.length / 2));
	let booting = $state(true);
	let closing = $state(false);
	let railActive = $state(0);
	let atTop = $state(true);
	let light = $state(false);
	let fxEnabled = false;
	const STAR =
		'M24 2C24.9 12.6 35.4 23.1 46 24 35.4 24.9 24.9 35.4 24 46 23.1 35.4 12.6 24.9 2 24 12.6 23.1 23.1 12.6 24 2Z';
	const SHOE =
		'M28.8352 27.0796C28.1482 26.4785 26.8315 25.9632 27.5757 24.8469C32.9573 17.0895 30.6959 4.69487 21.1636 1.48887C19.3316 0.830498 17.3851 0.515624 15.4671 0.515624C13.5492 0.515624 11.5741 0.859124 9.77068 1.48887C0.209768 4.7235 -2.02302 17.1181 3.35857 24.8469C4.10284 25.9346 2.78606 26.4785 2.09905 27.0796C1.64105 27.4517 1.58379 28.0815 1.95593 28.5109C2.75744 29.4269 3.58758 30.3429 4.41772 31.2302C4.81847 31.7169 5.44823 31.5737 5.87762 31.2302C7.91002 29.8849 9.91381 28.5395 11.9462 27.1941C12.1752 27.051 12.3183 26.8506 12.3756 26.593C12.4615 26.2209 12.3756 25.906 12.0607 25.6484C11.1733 24.8182 10.4863 23.8736 9.97106 22.7572C8.85466 20.2382 8.53978 16.8891 9.39855 14.2556C10.2859 11.4217 12.7764 9.876 15.4671 9.876C18.1579 9.876 20.6484 11.4217 21.5357 14.2556C22.3659 16.8891 22.0796 20.2382 20.9632 22.7572C20.448 23.845 19.761 24.8182 18.8736 25.6484C18.5873 25.906 18.4728 26.2209 18.5587 26.593C18.616 26.8506 18.7591 27.051 18.9881 27.1941C21.0205 28.5395 23.0243 29.8849 25.0567 31.2302C25.4861 31.5737 26.1158 31.6882 26.5166 31.2302C27.3467 30.3142 28.1482 29.4269 28.9784 28.5109C29.3791 28.0815 29.2933 27.4517 28.8352 27.0796Z';
	const BURST_COLORS = [
		'#f0b93f',
		'#ef5aa0',
		'#4aa8e0',
		'#7ac943',
		'#e8453c',
		'#f5821f',
		'#e2405e',
		'#ec3f7d',
		'#b06bd6',
		'#6fd0e8'
	];

	const pickColor = () => BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)];

	function starImg(color: string, core = false) {
		const paint = core
			? `<defs><radialGradient id="s" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="${color}"/></radialGradient><filter id="b" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.6"/></filter></defs><g filter="url(#b)" opacity=".7"><path d="${STAR}" fill="url(#s)"/></g><path d="${STAR}" fill="url(#s)" fill-opacity=".42"/>`
			: `<defs><filter id="b" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.5"/></filter></defs><g filter="url(#b)" opacity=".55"><path d="${STAR}" fill="${color}"/></g><path d="${STAR}" fill="${color}" fill-opacity=".4"/>`;
		return `url('data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${paint}</svg>`)}')`;
	}

	function shoeImg(color: string) {
		return `url('data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 31 33"><path fill="${color}" fill-opacity=".48" d="${SHOE}"/></svg>`)}')`;
	}

	type Bit = {
		dx: number;
		dy: number;
		size: number;
		spin: number;
		delay: number;
		img: string;
	};
	let taps = $state<{ id: number; x: number; y: number; core: string; bits: Bit[] }[]>([]);
	let sparks = $state<{ id: number; x: number; y: number; size: number; img: string }[]>([]);
	let tapSeq = 0;
	let sparkSeq = 0;
	let held = false;
	let heldX = 0;
	let heldY = 0;

	const title = $derived(titles[page.url.pathname] ?? 'Error');
	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname === href;

	function spawnTap(e: PointerEvent) {
		if (!fxEnabled) return;
		if (e.button !== 0 || (e.target as HTMLElement)?.closest('.fx-modal')) return;
		playClick();
		held = true;
		heldX = e.clientX;
		heldY = e.clientY;
		const id = ++tapSeq;
		const bits: Bit[] = Array.from({ length: 7 }, () => {
			const angle = Math.random() * Math.PI * 2;
			const dist = 26 + Math.random() * 40;
			return {
				dx: Math.cos(angle) * dist,
				dy: Math.sin(angle) * dist,
				size: 13 + Math.random() * 14,
				spin: (Math.random() * 2 - 1) * 160,
				delay: Math.random() * 0.07,
				img: Math.random() < 0.42 ? shoeImg(pickColor()) : starImg(pickColor())
			};
		});
		taps = [...taps, { id, x: e.clientX, y: e.clientY, core: starImg(pickColor(), true), bits }];
		setTimeout(() => {
			taps = taps.filter((t) => t.id !== id);
		}, 1200);
	}

	function spawnTrail(e: PointerEvent) {
		if (!fxEnabled || !held) return;
		if ((e.clientX - heldX) ** 2 + (e.clientY - heldY) ** 2 < 196) return;
		heldX = e.clientX;
		heldY = e.clientY;
		const id = ++sparkSeq;
		sparks = [
			...sparks,
			{ id, x: e.clientX, y: e.clientY, size: 13 + Math.random() * 9, img: starImg(pickColor()) }
		];
		setTimeout(() => {
			sparks = sparks.filter((s) => s.id !== id);
		}, 620);
	}

	function releaseTap() {
		held = false;
	}

	function onScroll() {
		atTop = window.scrollY < 8;
		if (!parallaxOn || parPending) return;
		parPending = true;
		requestAnimationFrame(applyParallax);
	}

	let bgEl: HTMLDivElement | undefined;
	let parPending = false;
	let parallaxOn = true;
	let sfx: HTMLAudioElement | undefined;

	function playClick() {
		if (!sfx) return;
		const node = sfx.paused ? sfx : (sfx.cloneNode() as HTMLAudioElement);
		node.volume = sfx.volume;
		node.currentTime = 0;
		node.play().catch(() => {});
	}

	function applyParallax() {
		parPending = false;
		if (!bgEl) return;
		const travel = window.innerHeight * 0.15;
		const y = parallaxOn ? -Math.min(window.scrollY * 0.22, travel) : 0;
		bgEl.style.setProperty('--par-y', `${y.toFixed(1)}px`);
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') fxOpen = false;
	}

	onMount(() => {
		onScroll();

		const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
		const compact = window.matchMedia('(max-width: 900px)').matches;
		light = !fine || compact;
		fxEnabled = fine;

		if (fxEnabled) {
			sfx = new Audio(clickSound);
			sfx.preload = 'auto';
			sfx.volume = 0.5;
		}

		if (light) {
			defaults.amount = 8;
			fxAmount = defaults.amount;
		}

		const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
			.connection;
		const thrifty = !!conn?.saveData || /2g|slow/i.test(conn?.effectiveType ?? '');
		const preload = (index: number) => {
			if (thrifty) return;
			const img = new Image();
			img.decoding = 'async';
			img.src = umas[index].src;
		};

		const timeouts: ReturnType<typeof setTimeout>[] = [];
		let reduced = false;
		try {
			reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		} catch {}

		let timer: ReturnType<typeof setInterval> | undefined;
		if (!light && !reduced) {
			timer = setInterval(() => {
				leftUma = (leftUma + 1) % umas.length;
				rightUma = (rightUma + 1) % umas.length;
				preload((leftUma + 1) % umas.length);
			}, 3500);
		}

		if (reduced) {
			booting = false;
		} else {
			timeouts.push(setTimeout(() => (closing = true), 520));
			timeouts.push(setTimeout(() => (booting = false), 1300));

			if (!light) timeouts.push(setTimeout(() => preload((leftUma + 1) % umas.length), 2100));
		}
		parallaxOn = !reduced && !light;

		return () => {
			if (timer) clearInterval(timer);
			timeouts.forEach(clearTimeout);
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<svelte:window
	onpointerdown={spawnTap}
	onpointermove={spawnTrail}
	onpointerup={releaseTap}
	onpointercancel={releaseTap}
	onblur={releaseTap}
	onscroll={onScroll}
	onkeydown={onKey}
/>

{#if booting}
	<Loading {closing} />
{/if}

<div class="uma-deco" class:is-booting={booting && !closing}>
	<div class="uma-bg" aria-hidden="true" bind:this={bgEl}></div>
	<div class="uma-veil" aria-hidden="true"></div>
	<div class="uma-fallers" style="--curve:{curves[fxCurve].value};">
		{#each fallers as f}
			<button
				type="button"
				class="faller"
				aria-label="Background effects"
				title="Background effects"
				onclick={() => (fxOpen = true)}
				onpointerenter={(e) => slowFaller(e, 0.12)}
				onpointerleave={(e) => slowFaller(e, 1)}
				onpointercancel={(e) => slowFaller(e, 1)}
				style="--carat:url({caratPng}); left:{f.left}; --dur:{f.dur}; --delay:{f.delay}; --size:{f.size}; --drift:{f.drift}; --spin:{f.spin}; --op:{f.opacity};"
			></button>
		{/each}
	</div>
</div>

<div class="uma-tap-layer" aria-hidden="true">
	{#each sparks as p (p.id)}
		<span
			class="uma-spark"
			style="left:{p.x}px; top:{p.y}px; --s:{p.size.toFixed(1)}px; --img:{p.img};"
		></span>
	{/each}
	{#each taps as t (t.id)}
		<span class="uma-tap" style="left:{t.x}px; top:{t.y}px; --core:{t.core};">
			<span class="uma-tap-glow"></span>
			<span class="uma-tap-ring"></span>
			<span class="uma-tap-core"></span>
			{#each t.bits as b}
				<span
					class="uma-bit"
					style="--dx:{b.dx.toFixed(1)}px; --dy:{b.dy.toFixed(1)}px; --size:{b.size.toFixed(1)}px; --spin:{b.spin.toFixed(0)}deg; --delay:{b.delay.toFixed(2)}s; --img:{b.img};"
				></span>
			{/each}
		</span>
	{/each}
</div>

<header class="topbar">
	<div class="tb-right">
		<span class="avatar">
			{#key leftUma}
				<img
					src={umas[leftUma].src}
					alt={umas[leftUma].name}
					transition:fade={{ duration: 600, easing: cubicOut }}
				/>
			{/key}
		</span>
	</div>
</header>

<a class="brand" class:is-top={atTop} href="/" aria-label="UmaPyoi">
	<img src={umapyoiLogo} alt="UmaPyoi" />
</a>

<aside class="rail">
	{#each rail as item, i}
		{@const Icon = item.icon}
		<a
			class="rail-tab"
			class:active={railActive === i}
			href={item.href}
			target={item.external ? '_blank' : undefined}
			onclick={() => (railActive = i)}
		>
			<span class="rail-ico"><Icon width="20" height="20" /></span>
			<span class="rail-label">{item.label}</span>
		</a>
	{/each}
</aside>

<main class="stage" id="top">
	<section class="panel">
		<div class="panel-head">
			<span class="ph-dots" aria-hidden="true"></span>
			{#key title}
				<span class="ph-title" in:fade={{ duration: 220 }}>{title}</span>
			{/key}
		</div>
		<div class="panel-body" bind:this={panelBody} style:height={swapH ? `${swapH}px` : null}>
			{#key page.url.pathname}
				<div class="page-swap" use:trackHeight in:popIn out:popOut>
					{@render children()}
				</div>
			{/key}
		</div>
	</section>

	<footer class="site-footer">
		<p><a href="https://github.com/cfels/website" target="_blank">src</a></p>
	</footer>
</main>

{#if !booting && !light}
	<div class="standee" aria-hidden="true">
		{#key rightUma}
			<img src={umas[rightUma].src} alt="" transition:fade={{ duration: 600, easing: cubicOut }} />
		{/key}
	</div>
{/if}

<nav class="bottombar">
	{#each tabs as tab}
		{@const Icon = tab.icon}
		<span class="tab-wrap">
			<a
				class="tab"
				class:active={isActive(tab.href)}
				href={tab.href}
				target={tab.external ? '_blank' : undefined}
			>
				<span class="tab-ico"><Icon width="24" height="24" /></span>
				<span class="tab-label">{tab.label}</span>
			</a>
			{#if tab.badge}<span class="badge" aria-hidden="true"></span>{/if}
		</span>
	{/each}
</nav>

{#if fxOpen}
	<div
		class="fx-modal"
		class:dragging
		role="dialog"
		aria-label="Background effects"
		style="translate:{fxPos.x}px {fxPos.y}px"
	>
		<div
			class="fx-head"
			role="presentation"
			onpointerdown={startDrag}
			onpointermove={moveDrag}
			onpointerup={endDrag}
			onpointercancel={endDrag}
		>
			<span class="fx-grip" aria-hidden="true"></span>
			<span class="fx-title">Background Fx</span>
			<button type="button" class="fx-x" onclick={closeFx} aria-label="Close">
				<svg viewBox="0 0 12 12" aria-hidden="true">
					<path d="M2.5 2.5 9.5 9.5M9.5 2.5 2.5 9.5" />
				</svg>
			</button>
		</div>
		<div class="fx-body">
			<div class="fx-row">
				<span class="fx-name">Fall Speed</span>
				<input type="range" min="0.4" max="2.5" step="0.1" bind:value={fxSpeed} />
				<b>{fxSpeed.toFixed(1)}×</b>
			</div>
			<div class="fx-row">
				<span class="fx-name">Amount</span>
				<input type="range" min="4" max="30" step="1" bind:value={fxAmount} />
				<b>{fxAmount}</b>
			</div>
			<div class="fx-row">
				<span class="fx-name">Drift</span>
				<input type="range" min="0" max="2.5" step="0.1" bind:value={fxDrift} />
				<b>{fxDrift.toFixed(1)}×</b>
			</div>
			<div class="fx-row">
				<span class="fx-name">Spin</span>
				<input type="range" min="0" max="2.5" step="0.1" bind:value={fxSpin} />
				<b>{fxSpin.toFixed(1)}×</b>
			</div>
			<div class="fx-curve">
				<span class="fx-name">Curve</span>
				<div class="fx-opts">
					{#each Object.entries(curves) as [key, c]}
						<button
							type="button"
							class="fx-opt"
							class:on={fxCurve === key}
							onclick={() => (fxCurve = key as Curve)}>{c.label}</button
						>
					{/each}
				</div>
			</div>
		</div>
		<div class="fx-foot">
			<button type="button" class="fx-btn ghost" onclick={resetFx}>Reset</button>
			<button type="button" class="fx-btn primary" onclick={closeFx}>Done</button>
		</div>
	</div>
{/if}

<style>

	@font-face {
		font-family: 'momotrust';
		src: url('$lib/assets/fonts/momotrust.ttf') format('truetype');
		font-weight: normal;
		font-style: normal;
		font-display: swap;
	}

	.uma-deco {
		display: contents;
	}

	.uma-deco.is-booting {
		display: none;
	}

	.uma-bg {
		position: fixed;
		left: -50px;

		top: -15vh;
		width: calc(100vw + 100px);
		height: 130vh;
		z-index: 0;

		background: url('$lib/assets/bg/bg.webp') center / cover no-repeat;
		transform: translate3d(0, var(--par-y, 0px), 0) scale(1.06);
		will-change: transform;
	}

	@supports (height: 100lvh) {
		.uma-bg {
			top: -15lvh;
			height: 130lvh;
		}
	}

	.uma-veil {
		position: fixed;
		inset: 0;
		z-index: 1;
		pointer-events: none;
		background:
			linear-gradient(
				180deg,
				rgba(18, 12, 6, 0.62),
				rgba(18, 12, 6, 0.38) 35%,
				rgba(18, 12, 6, 0.72)
			),
			repeating-linear-gradient(112deg, rgba(255, 255, 255, 0.05) 0 2px, transparent 2px 26px);
	}

	.uma-fallers {
		position: fixed;
		inset: 0;
		z-index: 2;
		pointer-events: none;
		overflow: hidden;
	}

	.faller {
		position: absolute;
		top: -70px;
		width: var(--size);
		height: var(--size);
		padding: 0;
		border: 0;
		background-image: var(--carat);
		background-repeat: no-repeat;
		background-position: center;
		background-size: contain;
		opacity: 0;
		pointer-events: auto;
		border-radius: 22%;
		filter: drop-shadow(0 2px 6px rgba(255, 176, 110, 0.5));
		animation-name: uma-fall;
		animation-duration: var(--dur);
		animation-timing-function: var(--curve, linear);
		animation-delay: var(--delay);
		animation-iteration-count: infinite;
		will-change: transform, opacity;
		backface-visibility: hidden;
	}

	.topbar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;

		z-index: 70;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		height: 64px;
		padding: 0 14px;
		overflow: visible;
		background: linear-gradient(180deg, rgba(255, 252, 246, 0.95), rgba(246, 238, 223, 0.91));
		border-bottom: 3px solid rgba(214, 197, 164, 0.9);
		box-shadow: 0 8px 20px -12px rgba(40, 25, 5, 0.7);
		backdrop-filter: blur(10px) saturate(1.2);
	}

	.brand {
		position: fixed;
		left: 14px;
		top: 13px;

		z-index: 90;
		display: block;
		line-height: 0;
		text-decoration: none;
		transition: top 0.3s cubic-bezier(0.19, 1, 0.22, 1);
	}

	.brand.is-top {
		top: 15px;
	}

	.brand img {
		display: block;
		width: auto;
		height: 38px;
		filter: drop-shadow(0 2px 2px rgba(120, 80, 20, 0.28));
		transition: height 0.3s cubic-bezier(0.19, 1, 0.22, 1);
	}

	.brand.is-top img {
		height: 76px;
	}

	.tb-right {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		margin-left: auto;
	}

	.avatar {
		position: relative;
		width: 42px;
		height: 42px;
		flex-shrink: 0;
		display: grid;
		place-items: center;
		overflow: hidden;
		border-radius: 14px;
		background: radial-gradient(circle at 50% 30%, #fff, #efe6d0);
		border: 2px solid #fffdf7;
		box-shadow: 0 0 0 2px #e2d5b8, 0 3px 6px rgba(120, 95, 50, 0.25);
	}

	.avatar img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.rail {
		position: fixed;
		top: 84px;
		right: 10px;
		z-index: 28;
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 78px;
	}

	.rail-tab {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 8px 4px 7px;
		border-radius: 13px;
		background: linear-gradient(180deg, #fffdf8, #f2e9d6);
		border: 2px solid #e8dfc9;
		color: var(--ink-soft);
		font-size: 0.63rem;
		font-weight: 700;
		text-decoration: none;
		text-align: center;
		box-shadow: 0 2px 0 rgba(198, 183, 152, 0.55);
		transition:
			transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275),
			background 0.2s ease,
			color 0.2s ease,
			border-color 0.2s ease;
	}

	.rail-tab:hover {
		transform: translateX(-4px) scale(0.96);
		color: var(--green-d);
	}

	.rail-tab.active {
		background: linear-gradient(180deg, var(--green-l), var(--green-d));
		border-color: var(--green-d);
		color: #fff;
		box-shadow: 0 2px 0 rgba(74, 143, 32, 0.5), 0 6px 14px -6px rgba(74, 143, 32, 0.6);
	}

	.rail-tab.active::before {
		content: '';
		position: absolute;
		left: -10px;
		top: 50%;
		width: 15px;
		height: 15px;
		border-radius: 3px;
		background: var(--green);
		transform: translateY(-50%) rotate(45deg);
	}

	.rail-ico {
		display: grid;
		place-items: center;
	}

	.stage {
		position: relative;
		z-index: 5;
		max-width: 1180px;
		margin: 0 auto;
		padding: 104px 96px 124px;
		box-sizing: border-box;
		pointer-events: none;
	}

	.stage > * {
		pointer-events: auto;
	}

	.panel {
		position: relative;
		width: 100%;
		max-width: 740px;
		margin: 0 auto;
		background: linear-gradient(180deg, var(--cream), var(--cream-2));
		border: 3px solid #fffdf7;
		border-radius: 22px;
		box-shadow:
			0 0 0 2px #d9c9a6,
			0 26px 60px -18px rgba(20, 10, 0, 0.65),
			inset 0 0 0 1px rgba(255, 255, 255, 0.8);
		overflow: hidden;
		animation: panel-in 0.55s cubic-bezier(0.22, 1.2, 0.36, 1) both;
	}

	.panel-head {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 46px;
		margin: 10px 10px 6px;
		overflow: hidden;
		border-radius: 9px;
		background: linear-gradient(180deg, #9ade63, #71bd3a 55%, #65b232);
		box-shadow:
			inset 0 2px 0 rgba(255, 255, 255, 0.45),
			inset 0 -10px 18px rgba(0, 0, 0, 0.08),
			0 3px 0 rgba(74, 143, 32, 0.35);
	}

	.ph-dots {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(rgba(255, 255, 255, 0.55) 1.4px, transparent 1.6px);
		background-size: 12px 12px;
		opacity: 0.45;
	}

	.ph-title {
		position: relative;
		font-size: 1.2rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: #fff;
		text-shadow: 0 2px 0 rgba(63, 120, 26, 0.55);
	}

	.panel-body {
		position: relative;
		isolation: isolate;
		padding: 4px 14px 18px;
		transition: height 460ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.page-swap {
		min-width: 0;
	}

	.panel-body::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background-image: radial-gradient(rgba(196, 178, 140, 0.55) 1px, transparent 1.4px);
		background-size: 14px 14px;
		opacity: 0.4;
	}

	.site-footer {
		margin-top: 18px;
		text-align: center;
		color: #f3e7cd;
		font-family: var(--font);
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
	}

	.site-footer p {
		margin: 0;
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.15em;
	}

	.site-footer a {
		color: rgba(255, 243, 214, 0.52);
		text-decoration: none;
		transition: color 0.18s ease;
	}

	.site-footer a:hover {
		color: rgba(255, 255, 255, 0.86);
	}

	.standee {
		position: fixed;
		left: 20px;
		bottom: 100px;
		z-index: 6;
		width: 152px;
		height: 152px;
		display: grid;
		place-items: center;
		box-sizing: border-box;
		border-radius: 26px;
		background: linear-gradient(180deg, #fffdf8, #f4ebd6);
		border: 3px solid #fffdf7;
		box-shadow: 0 0 0 2px #d9c9a6, 0 18px 28px -16px rgba(0, 0, 0, 0.75);
		overflow: hidden;
		pointer-events: none;
		animation: standee-bob 3.6s ease-in-out infinite;
	}

	.standee img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.bottombar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 70;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		gap: 12px;
		padding: 10px 12px 8px;
		background: linear-gradient(180deg, rgba(255, 252, 246, 0.9), rgba(246, 238, 223, 0.98));
		border-top: 3px solid rgba(214, 197, 164, 0.9);
		box-shadow: 0 -8px 20px -12px rgba(40, 25, 5, 0.55);
		backdrop-filter: blur(6px);
	}

	.tab-wrap {
		position: relative;
		display: inline-flex;
		transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
	}

	.tab-wrap:hover {
		transform: translateY(-4px);
	}

	.tab-wrap:has(.tab.active) {
		transform: translateY(-12px) scale(1.06);
	}

	.tab {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		width: 104px;
		padding: 8px 6px 7px;
		border-radius: 14px 14px 10px 10px;
		background: linear-gradient(180deg, #fffefb, #f1e8d4);
		border: 2px solid #e6dcc4;
		color: var(--ink-soft);
		font-size: 0.72rem;
		font-weight: 700;
		text-decoration: none;
		box-shadow: 0 3px 0 rgba(198, 183, 152, 0.6);
		transition:
			background 0.2s ease,
			color 0.2s ease,
			border-color 0.2s ease,
			box-shadow 0.2s ease,
			transform 0.16s ease;
	}

	.tab:hover {
		color: var(--green-d);
	}

	.tab:active {
		transform: translateY(1px) scale(0.97);
	}

	.tab.active {
		background: linear-gradient(180deg, #8fd4f2, #3d9dd8);
		border-color: #fffdf7;
		color: #fff;
		box-shadow: 0 6px 0 rgba(43, 122, 175, 0.5), 0 14px 22px -10px rgba(43, 122, 175, 0.7);
	}

	.tab-ico {
		display: grid;
		place-items: center;
		height: 24px;
	}

	.badge {
		position: absolute;
		top: -9px;
		right: -6px;
		width: 19px;
		height: 19px;
		border-radius: 999px;
		background: linear-gradient(180deg, #ff8aa8, #ee3f66);
		border: 2px solid #fffdf8;
		box-shadow: 0 2px 5px rgba(200, 40, 80, 0.5);
		z-index: 2;
	}

	.badge::after {
		content: '';
		position: absolute;
		inset: -4px;
		border-radius: 999px;
		border: 2px solid rgba(238, 63, 102, 0.65);
		will-change: transform, opacity;
		animation: badge-pulse 1.6s ease-out infinite;
	}

	@keyframes badge-pulse {
		0% {
			transform: scale(0.75);
			opacity: 0.9;
		}
		100% {
			transform: scale(1.5);
			opacity: 0;
		}
	}

	.fx-modal {
		position: fixed;
		z-index: 201;
		top: 84px;
		right: 18px;
		width: min(340px, calc(100vw - 30px));
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: 16px;
		border: 3px solid #fffdf7;
		background: linear-gradient(180deg, var(--cream), var(--cream-2));
		box-shadow:
			0 0 0 2px #d9c9a6,
			0 28px 56px -20px rgba(20, 10, 0, 0.75),
			inset 0 0 0 1px rgba(255, 255, 255, 0.8);
		color: var(--ink);
		animation: fx-in 0.22s cubic-bezier(0.22, 1.2, 0.36, 1) both;
		touch-action: none;
	}

	@keyframes fx-in {
		from {
			opacity: 0;
			transform: translateY(-10px) scale(0.97);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.fx-head {
		position: relative;
		display: flex;
		align-items: center;
		gap: 8px;
		height: 38px;
		padding: 0 8px 0 12px;
		margin: 8px 8px 0;
		border-radius: 9px;
		background: linear-gradient(180deg, #8fd053, #66b332);
		color: #fff;
		text-shadow: 0 1px 0 rgba(50, 96, 20, 0.55);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 2px 0 rgba(74, 143, 32, 0.32);
	}

	.fx-modal.dragging .fx-head {
		background: linear-gradient(180deg, #9ade63, #71bd3a);
	}

	.fx-grip {
		width: 10px;
		height: 16px;
		flex-shrink: 0;
		background-image: radial-gradient(rgba(255, 255, 255, 0.85) 1.1px, transparent 1.3px);
		background-size: 5px 5px;
		opacity: 0.8;
	}

	.fx-title {
		flex: 1;
		font-size: 0.98rem;
		font-weight: 700;
		letter-spacing: 0.05em;
	}

	.fx-x {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		flex-shrink: 0;
		padding: 0;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.4);
		background: rgba(255, 255, 255, 0.14);
		color: #fff;
		transition:
			background 0.18s ease,
			border-color 0.18s ease,
			transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.fx-x svg {
		width: 12px;
		height: 12px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2.6;
		stroke-linecap: round;
	}

	.fx-x:hover {
		background: #ee3f66;
		border-color: #fff;
		transform: rotate(90deg);
	}

	.fx-body {
		display: flex;
		flex-direction: column;
		gap: 11px;
		padding: 12px 14px 14px;
	}

	.fx-row,
	.fx-curve {
		display: flex;
		align-items: center;
		gap: 9px;
		min-width: 0;
	}

	.fx-curve {
		flex-direction: column;
		align-items: stretch;
		gap: 8px;
	}

	.fx-name {
		min-width: 76px;
		flex-shrink: 0;
		font-size: 0.66rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}

	.fx-row b {
		min-width: 36px;
		flex-shrink: 0;
		text-align: right;
		font-size: 0.8rem;
		font-weight: 800;
		color: var(--green-d);
	}

	.fx-row input[type='range'] {
		flex: 1;
		min-width: 0;
		width: 100%;
		height: 8px;
		appearance: none;
		-webkit-appearance: none;
		border-radius: 999px;
		background: linear-gradient(90deg, #9ade63, #5da32c);
		box-shadow: inset 0 1px 3px rgba(90, 70, 30, 0.35);
	}

	.fx-row input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		border: 3px solid var(--green-d);
		background: radial-gradient(circle at 35% 30%, #fff, #e9e2d2);
		box-shadow: 0 2px 5px rgba(70, 55, 25, 0.45);
	}

	.fx-row input[type='range']::-moz-range-thumb {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 3px solid var(--green-d);
		background: #fff;
	}

	.fx-opts {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.fx-opt {
		flex: 1 1 auto;
		min-width: 0;
		padding: 0.42rem 0.45rem;
		border-radius: 9px;
		border: 2px solid #e6dcc4;
		background: linear-gradient(180deg, #fffefb, #f1e8d4);
		color: var(--ink-soft);
		font-family: var(--font);
		font-size: 0.73rem;
		font-weight: 800;
		box-shadow: 0 2px 0 rgba(198, 183, 152, 0.6);
		transition:
			transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
			background 0.16s ease,
			color 0.16s ease,
			border-color 0.16s ease;
	}

	.fx-opt:hover {
		transform: translateY(-2px);
		color: var(--green-d);
	}

	.fx-opt.on {
		background: linear-gradient(180deg, var(--green-l), var(--green-d));
		border-color: var(--green-d);
		color: #fff;
		text-shadow: 0 1px 0 rgba(63, 120, 26, 0.5);
		box-shadow: 0 2px 0 rgba(74, 143, 32, 0.4);
	}

	.fx-foot {
		display: flex;
		gap: 10px;
		padding: 0 16px 16px;
	}

	.fx-btn {
		flex: 1;
		padding: 0.6rem;
		border: 2px solid #fffdf7;
		border-radius: 12px;
		font-family: var(--font);
		font-size: 0.96rem;
		font-weight: 800;
		color: #fff;
		transition: transform 0.09s ease, box-shadow 0.09s ease;
	}

	.fx-btn.ghost {
		background: linear-gradient(180deg, #fffefb, #efe5d0);
		border-color: #e6dcc4;
		color: var(--ink-soft);
		text-shadow: none;
		box-shadow: 0 4px 0 rgba(198, 183, 152, 0.7);
	}

	.fx-btn.primary {
		background: linear-gradient(180deg, #a5d95f, #7cbf31);
		box-shadow: 0 4px 0 #5a9420;
		text-shadow: 0 1px 0 rgba(50, 96, 20, 0.45);
	}

	.fx-btn:active {
		transform: translateY(4px);
		box-shadow: 0 0 0 rgba(0, 0, 0, 0);
	}

	@media (max-width: 1180px) {
		.standee {
			display: none;
		}
	}

	@media (hover: none), (max-width: 900px) {
		.topbar {
			background: linear-gradient(180deg, rgba(255, 252, 246, 0.99), rgba(246, 238, 223, 0.97));
			-webkit-backdrop-filter: none;
			backdrop-filter: none;
		}

		.bottombar {
			background: linear-gradient(180deg, rgba(255, 252, 246, 0.97), rgba(246, 238, 223, 1));
			-webkit-backdrop-filter: none;
			backdrop-filter: none;
		}

		.uma-bg {
			will-change: auto;
		}

		.faller {
			filter: none;
		}
	}

	@media (max-width: 1000px) {
		.rail {
			display: none;
		}
		.stage {
			padding: 104px 14px 116px;
		}
	}

	@media (max-width: 760px) {
		.tab {
			width: 86px;
			font-size: 0.68rem;
		}
	}

	@media (max-width: 560px) {
		.panel-head {
			height: 40px;
			margin: 8px 8px 4px;
			border-radius: 8px;
		}
		.ph-title {
			font-size: 1.02rem;
		}
		.panel-body {
			padding: 2px 10px 14px;
		}
		.tab {
			width: 74px;
			padding: 7px 2px 6px;
		}
		.bottombar {
			gap: 6px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.faller,
		.standee,
		.badge::after {
			animation: none;
		}
		.panel {
			animation: none;
		}
	}
</style>
