<script lang="ts">
	interface Props {
		label: string;
		hint?: string;
		onclick: () => void;
	}

	let { label, hint, onclick }: Props = $props();
</script>

<button
	type="button"
	{onclick}
	class="group w-full rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--bg-2)]
		px-6 py-5 text-left transition-all duration-200
		hover:-translate-y-0.5 hover:border-[var(--accent)]
		focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
	style="box-shadow: var(--shadow)"
>
	<span class="font-display block text-lg font-semibold text-[var(--ink)] sm:text-xl">{label}</span>
	{#if hint}
		<span class="mt-1 block text-sm text-[var(--ink-muted)]">{hint}</span>
	{/if}
</button>
