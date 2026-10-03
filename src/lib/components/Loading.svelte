<script lang="ts">
	import specialWeek from '$lib/assets/uma/special-week.webp';
	import UmaWordmark from './UmaWordmark.svelte';

	let { closing = false } = $props();
</script>

<div class="uma-loading" class:is-close={closing}>
	<div class="uma-loading-bg" aria-hidden="true"></div>
	<div class="chara">
		<div class="chara-img"><img src={specialWeek} alt="" /></div>
		<UmaWordmark />
	</div>
</div>
