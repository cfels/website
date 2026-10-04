<script lang="ts">
    import { onMount } from "svelte";
    import { reveal } from "$lib/reveal";
    import "spoilerjs/spoiler-span";
    import MusicIcon from "~icons/mingcute/music-2-line";
    import TvIcon from "~icons/mingcute/tv-2-line";
    import BrushIcon from "~icons/mingcute/paint-brush-line";
    import CakeIcon from "~icons/mingcute/cake-line";
    import TranslateIcon from "~icons/mingcute/translate-2-line";
    import PhoneIcon from "~icons/mingcute/phone-line";
    import DiscordIcon from "~icons/mingcute/discord-line";
    import TelegramIcon from "~icons/mingcute/telegram-line";
    import MailIcon from "~icons/mingcute/mail-line";

    const atVariants = ["|at|", "[@]", "(at)", "{@}", "[at]", "(@)", "<at>"];
    const dotVariants = [
        "|dot|",
        "[.]",
        "(dot)",
        "{.}",
        "[dot]",
        "(.)",
        "<dot>",
    ];

    function pick<T>(arr: T[]): T {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    const emailDisplay = `moxiix ${pick(atVariants)} proton ${pick(dotVariants)} com`;

    let mounted = $state(false);
    let seekMonitor = $state(false);
    onMount(() => {
        seekMonitor =
            window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
            !window.matchMedia("(max-width: 900px)").matches;
        const ready =
            "fonts" in document ? document.fonts.ready : Promise.resolve();
        ready.then(() => {
            setTimeout(() => {
                mounted = true;
            }, 650);
        });
    });

    let scrubTimer: ReturnType<typeof setTimeout> | undefined;

    function revealEmail() {
        clearTimeout(scrubTimer);
        scrubTimer = setTimeout(() => {
            for (const node of document.querySelectorAll("body > canvas")) {
                const canvas = node as HTMLCanvasElement;
                canvas.style.transition = "opacity 0.3s ease";
                canvas.style.opacity = "0";
                setTimeout(() => canvas.remove(), 320);
            }
        }, 1200);
    }

    type SpoilerEl = HTMLElement & {
        revealed?: boolean;
        particleManagers?: { stopSpawning(): void }[];
        updateCanvasPositionsImmediate?: () => void;
    };

    function settleSpoiler(el: SpoilerEl) {
        el.particleManagers?.forEach((m) => m.stopSpawning());
        const inner = el.shadowRoot?.querySelector("div");
        if (inner?.classList.contains("revealed")) return;
        for (const node of document.querySelectorAll("body > canvas")) node.remove();
        el.revealed = true;
        if (inner) {
            inner.classList.remove("hidden", "revealing");
            inner.classList.add("revealed");
        }
    }

    function emailReveal(node: HTMLElement) {
        const el = node as SpoilerEl;
        const touch = window.matchMedia("(hover: none), (max-width: 900px)").matches;
        let settle: ReturnType<typeof setTimeout> | undefined;
        let raf = 0;
        let watching = false;
        const watcher = new MutationObserver(() => queueCursor());
        const applyCursor = () => {
            const shadow = el.shadowRoot;
            if (!shadow) return false;
            if (!watching) {
                watching = true;
                watcher.observe(shadow, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ["class"],
                });
            }
            el.style.setProperty("cursor", "inherit");
            if (!shadow.querySelector("style[data-uma-cursor]")) {
                const style = document.createElement("style");
                style.setAttribute("data-uma-cursor", "");
                style.textContent = "div{cursor:inherit!important}";
                shadow.appendChild(style);
            }
            const inner = shadow.querySelector<HTMLElement>("div");
            if (inner && inner.style.getPropertyValue("cursor") !== "inherit")
                inner.style.setProperty("cursor", "inherit", "important");
            return true;
        };
        const queueCursor = () => {
            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = 0;
                applyCursor();
            });
        };
        queueCursor();
        let poll: ReturnType<typeof setInterval> | undefined;
        if (!applyCursor())
            poll = setInterval(() => {
                if (applyCursor() && poll) clearInterval(poll);
            }, 120);
        const onClick = () => {
            applyCursor();
            revealEmail();
            if (!touch) return;
            clearTimeout(settle);
            settle = setTimeout(() => settleSpoiler(el), 1100);
        };
        node.addEventListener("click", onClick);
        return {
            destroy: () => {
                clearTimeout(settle);
                if (poll) clearInterval(poll);
                if (raf) cancelAnimationFrame(raf);
                watcher.disconnect();
                node.removeEventListener("click", onClick);
            },
        };
    }

    function spoilerTrack(node: HTMLElement) {
        const el = node as SpoilerEl;
        const viewport = window.visualViewport;
        let raf = 0;
        let fast: ReturnType<typeof setTimeout> | undefined;
        let slow: ReturnType<typeof setTimeout> | undefined;
        let visible = true;
        let dead = false;

        const sync = () => {
            raf = 0;
            if (dead || !visible || el.revealed) return;
            el.updateCanvasPositionsImmediate?.();
        };
        const schedule = () => {
            if (!raf && !dead) raf = requestAnimationFrame(sync);
        };
        const onMove = () => {
            schedule();
            clearTimeout(fast);
            clearTimeout(slow);
            fast = setTimeout(schedule, 150);
            slow = setTimeout(schedule, 550);
        };

        const observer = new IntersectionObserver((entries) => {
            visible = entries[entries.length - 1].isIntersecting;
            if (visible) schedule();
        });
        observer.observe(node);

        window.addEventListener("scroll", onMove, { passive: true });
        window.addEventListener("resize", onMove, { passive: true });
        window.addEventListener("scrollend", onMove, { passive: true });
        viewport?.addEventListener("resize", onMove);
        viewport?.addEventListener("scroll", onMove);

        const boot = setInterval(schedule, 80);
        const bootStop = setTimeout(() => clearInterval(boot), 900);

        return {
            destroy() {
                dead = true;
                if (raf) cancelAnimationFrame(raf);
                clearTimeout(fast);
                clearTimeout(slow);
                clearInterval(boot);
                clearTimeout(bootStop);
                observer.disconnect();
                window.removeEventListener("scroll", onMove);
                window.removeEventListener("resize", onMove);
                window.removeEventListener("scrollend", onMove);
                viewport?.removeEventListener("resize", onMove);
                viewport?.removeEventListener("scroll", onMove);
            },
        };
    }

</script>

<div class="uma-content">
    <div class="uma-card intro reveal" use:reveal>
        <p class="hiii">Haiii~</p>
        <p>I'm <strong>Moxiu</strong>, part time horse?</p>
        <p>
            Also, what do I do? Well, I mainly mess around with reverse
            engineering, Linux and stuff — so I mostly do low-level work, but
            not only!
        </p>
        <p class="muted">PS. Dualbooting sucks (my opinion).</p>
        <p>
            All my projects and stuff are on
            <a href="https://github.com/cfels" target="_blank">GitHub</a>.
        </p>
    </div>

    <h2 class="uma-section reveal" id="info" use:reveal><span>Interesting Info (Not Really)</span><i></i></h2>
    <div class="uma-card list reveal" use:reveal={70}>
        <div class="uma-tile uma-row">
            <span class="uma-tile-ico ic-music"><MusicIcon width="18" height="18" /></span>
            <span class="uma-label">Fav Music</span>
            <span class="uma-value"
                >Rap, hip-hop, etc. — if it's good, I listen to it.</span
            >
        </div>
        <div class="uma-tile uma-row">
            <span class="uma-tile-ico ic-anime"><TvIcon width="18" height="18" /></span>
            <span class="uma-label">Fav Anime</span>
            <span class="uma-value"
                ><a
                    href="https://anilist.co/anime/175977/My-Deer-Friend-Nokotan/"
                    target="_blank">しかのこのこのここしたんたん</a
                ></span
            >
        </div>
        <div class="uma-tile uma-row">
            <span class="uma-tile-ico ic-color"><BrushIcon width="18" height="18" /></span>
            <span class="uma-label">Fav Color</span>
            <span class="uma-value"><span class="dot"></span>#fad6ff</span>
        </div>
        <div class="uma-tile uma-row">
            <span class="uma-tile-ico ic-cake"><CakeIcon width="18" height="18" /></span>
            <span class="uma-label">Birthday</span>
            <span class="uma-value">January 24 (15yo) ♒ Aquarius</span>
        </div>
        <div class="uma-tile uma-row">
            <span class="uma-tile-ico ic-lang"><TranslateIcon width="18" height="18" /></span>
            <span class="uma-label">Langs</span>
            <span class="uma-value"
                ><img
                    src="https://flagcdn.com/16x12/pl.png"
                    alt="PL"
                    width="16"
                    height="12"
                />
                Polish (native),
                <img
                    src="https://flagcdn.com/16x12/gb.png"
                    alt="GB"
                    width="16"
                    height="12"
                /> C1</span
            >
        </div>
    </div>

    <h2 class="uma-section reveal" id="contact" use:reveal><span>Contact Me</span><i></i></h2>
    <div class="uma-card list reveal" use:reveal={70}>
        <div class="uma-tile uma-row">
            <span class="uma-tile-ico ic-phone"><PhoneIcon width="18" height="18" /></span>
            <span class="uma-label">Phone</span>
            <span class="uma-value">Nope :p</span>
        </div>
        <div class="uma-tile uma-row discord-row">
            <span class="uma-tile-ico ic-discord"><DiscordIcon width="18" height="18" /></span>
            <span class="uma-label">Discord</span>
            <span class="uma-value"
                ><a
                    href="https://discord.com/users/1154823136710246441"
                    target="_blank">@moxiiuu</a
                ></span
            >
        </div>
        <div class="uma-tile uma-row telegram-row">
            <span class="uma-tile-ico ic-telegram">
                <span class="plane-hitbox">
                    <span class="plane-wrap">
                        <TelegramIcon width="18" height="18" />
                    </span>
                </span>
            </span>
            <span class="uma-label">Telegram</span>
            <span class="uma-value"
                ><a href="https://t.me/cfelz" target="_blank">t.me/cfelz</a
                ></span
            >
        </div>
        <div class="uma-tile uma-row email-row">
            <span class="uma-tile-ico ic-mail"><MailIcon width="18" height="18" /></span>
            <span class="uma-label">Email</span>
            <span class="uma-value">
                {#if mounted}
                    <spoiler-span
                        reveal-duration="150"
                        spawn-stop-delay="40"
                        particle-lifetime="50"
                        monitor-position={seekMonitor ? "true" : undefined}
                        use:emailReveal
                        use:spoilerTrack>{emailDisplay}</spoiler-span
                    >
                {:else}
                    <span class="pending">Loading…</span>
                {/if}
            </span>
        </div>
    </div>

</div>

<style>
    .intro {
        padding: 14px 16px;
    }
    .hiii {
        font-size: 1.28rem;
        font-weight: 800;
        color: var(--green-d);
    }
    .intro .muted {
        color: var(--ink-soft);
    }

    .ic-music {
        background: linear-gradient(180deg, #c9a6f7, #a774e8);
    }
    .ic-anime {
        background: linear-gradient(180deg, #ff9ec4, #f2607f);
    }
    .ic-color {
        background: linear-gradient(180deg, #e0a3f5, #b06ae0);
    }
    .ic-cake {
        background: linear-gradient(180deg, #8fd4f2, #52a9e2);
    }
    .ic-lang {
        background: linear-gradient(180deg, #9ade63, #5da32c);
    }
    .ic-phone {
        background: linear-gradient(180deg, #c3ccd8, #8ea0b3);
    }
    .ic-discord {
        background: linear-gradient(180deg, #a3aef2, #6373e0);
    }
    .ic-telegram {
        background: linear-gradient(180deg, #7fd4ee, #2fa3d8);
    }
    .ic-mail {
        background: linear-gradient(180deg, #ffca8a, #f09a3c);
    }

    .discord-row .uma-tile-ico {
        transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .discord-row:hover .uma-tile-ico {
        transform: rotate(360deg);
    }

    .plane-hitbox {
        position: relative;
        width: 18px;
        height: 18px;
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
    .telegram-row:hover .plane-wrap {
        animation: plane-loop-anim 0.9s cubic-bezier(0.45, 0, 0.55, 1) forwards;
    }
    @keyframes plane-loop-anim {
        0% {
            transform: translate(0, 0) rotate(0deg);
            opacity: 1;
        }
        38% {
            transform: translate(130%, -130%) rotate(-22deg);
            opacity: 0;
        }
        40% {
            transform: translate(-130%, 130%) rotate(22deg);
            opacity: 0;
        }
        100% {
            transform: translate(0, 0) rotate(0deg);
            opacity: 1;
        }
    }

    .dot {
        display: inline-block;
        width: 11px;
        height: 11px;
        border-radius: 50%;
        background: #fad6ff;
        margin-right: 4px;
        vertical-align: middle;
        border: 0.5px solid #b98fc4;
    }

    .pending {
        color: var(--ink-soft);
        font-size: 0.9rem;
    }

    .email-row :global(spoiler-span) {
        font-weight: 600;
        color: var(--ink);
    }

    .email-row .uma-value {
        flex: 1 0 auto;
        white-space: nowrap;
    }

    @media (max-width: 560px) {
        .email-row .uma-label {
            flex: 0 1 88px;
            min-width: 0;
            overflow: hidden;
        }
        .email-row .uma-value {
            font-size: 0.9rem;
        }
    }

</style>
