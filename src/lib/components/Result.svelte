<script lang="ts">
	import { cardsByMode } from '$lib/data/cards';
	import type { Mode, Reading } from '$lib/engine/types';

	interface Props {
		mode: Mode;
		reading: Reading;
		chosenId: string | null;
		copied: boolean;
		onReroll: () => void;
		onRestart: () => void;
		onCopy: () => void;
	}

	let { mode, reading, chosenId, copied, onReroll, onRestart, onCopy }: Props = $props();

	const card = $derived(cardsByMode[mode].find((c) => c.id === chosenId));
	const meterLabel = $derived(mode === 'heaven' ? 'ระดับดวง' : 'ระดับดวง (ของอีนั่น)');
</script>

<div class="mx-auto w-full max-w-2xl">
	{#if card}
		<p class="text-center text-sm text-[var(--ink-muted)]">
			ไพ่ที่เปิดได้ · <span class="font-display font-semibold text-[var(--accent)]">{card.name}</span>
		</p>
	{/if}

	<!-- Fortune meter: 97-100 in HEAVEN, 0-3 in HELL. Never anything between. -->
	<div class="mt-4">
		<div class="flex items-baseline justify-between text-xs text-[var(--ink-muted)]">
			<span>{meterLabel}</span>
			<span class="font-display text-2xl font-bold text-[var(--accent)]">{reading.meter}%</span>
		</div>
		<div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--line)]">
			<div
				class="meter-fill h-full rounded-full bg-[var(--accent)]"
				style="--target: {reading.meter}%"
			></div>
		</div>
	</div>

	<div
		class="reading mt-6 space-y-4 rounded-[var(--radius-card)] border border-[var(--line)]
			bg-[var(--bg-2)] px-5 py-6 sm:px-7 sm:py-8"
		style="box-shadow: var(--shadow)"
	>
		{#each reading.lines as line, i (i)}
			<p class="font-display text-[var(--ink)]" style="animation-delay: {i * 140}ms">{line}</p>
		{/each}
	</div>

	<div class="mt-6 flex flex-wrap justify-center gap-3">
		<button
			type="button"
			onclick={onReroll}
			class="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-ink)]
				transition-transform hover:-translate-y-0.5"
		>
			ดูใหม่อีกรอบ
		</button>
		<button
			type="button"
			onclick={onCopy}
			class="rounded-full border border-[var(--line)] bg-[var(--bg-2)] px-5 py-3 text-sm
				font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
		>
			{copied ? 'คัดลอกแล้ว' : 'คัดลอกคำทำนาย'}
		</button>
		<button
			type="button"
			onclick={onRestart}
			class="rounded-full px-5 py-3 text-sm font-medium text-[var(--ink-muted)] underline
				underline-offset-4 hover:text-[var(--ink)]"
		>
			เริ่มใหม่ทั้งหมด
		</button>
	</div>
</div>

<style>
	.reading p {
		animation: fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.meter-fill {
		width: var(--target);
		animation: fill 1s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes fade-up {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@keyframes fill {
		from {
			width: 0;
		}
		to {
			width: var(--target);
		}
	}
</style>
