<script lang="ts">
	let { kind }: { kind: string } = $props();
</script>

<svg viewBox="0 0 88 72" fill="none" aria-hidden="true">
	<g stroke="#73534c" stroke-width="2.5" stroke-linejoin="round">
		{#if kind === 'Home'}
			<path d="M5 58 11 47 20 44 25 58Z" fill="#8ed346" />
			<path d="m65 57 2-12 10-3 7 16Z" fill="#8ed346" />
			<path d="M15 30h58v32H15Z" fill="#fff3d6" />
			<path d="m9 30 12-12h46l12 12Z" fill="#63bbeb" />
			<path d="M30 22h28v41H30Z" fill="#e6bc84" />
			<path d="m25 22 19-17 19 17Z" fill="#78cafa" />
			<path d="M39 9V2h10v7" fill="#fff2d1" />
			<path d="M39 63V47h10v16" fill="#897383" />
			<path d="M20 36h6v8h-6Zm42 0h6v8h-6ZM20 49h6v8h-6Zm42 0h6v8h-6ZM39 27h10v12H39Z" fill="#83d8f4" stroke="#fff9e7" />
			<path d="M12 65h64" stroke="#fff9e7" stroke-width="5" />
		{:else if kind === 'Yapping'}
			<path d="M9 17q0-7 8-7h45q8 0 8 7v28q0 7-8 7H35L20 64V52h-3q-8 0-8-7Z" fill="#ffe8f0" />
			<path d="M19 17h41" stroke="white" stroke-width="4" />
			<path d="M44 33q0-5 6-5h22q7 0 7 6v19q0 6-7 6h-5l-1 8-10-8h-6q-6 0-6-6Z" fill="#bca3ea" />
			<g fill="#e97ba3" stroke="none"><circle cx="24" cy="33" r="4" /><circle cx="37" cy="33" r="4" /><circle cx="50" cy="33" r="4" /></g>
			<path d="m56 45 5 5 9-10" stroke="white" stroke-width="3" />
		{:else}
			<path d="M20 31h49v33H20Z" fill="#ffeff0" />
			<path d="M15 24h59v14H15Z" fill="#fff5df" />
			<path d="M39 24h11v40H39Z" fill="#f2769f" />
			<path d="M43 24C12 25 19 1 31 8q8 4 12 16Zm2 0C76 25 69 1 57 8q-8 4-12 16Z" fill="#f79aba" />
			<path d="m72 4 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#ffcc65" stroke="#c59346" stroke-width="1.5" />
		{/if}
	</g>
</svg>
