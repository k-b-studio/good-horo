<script lang="ts">
	import { cardsByMode } from '$lib/data/cards';
	import type { Mode, Reading } from '$lib/engine/types';

	interface Props {
		mode: Mode;
		reading: Reading;
		chosenId: string | null;
		rerolling: boolean;
		sharing: boolean;
		shareResult: 'shared' | 'downloaded' | 'failed' | null;
		/** Changes per reading so the reveal animation replays on re-roll. */
		version: number;
		onReroll: () => void;
		onAnotherCard: () => void;
		onRestart: () => void;
		onShare: () => void;
	}

	let {
		mode,
		reading,
		chosenId,
		rerolling,
		sharing,
		shareResult,
		version,
		onReroll,
		onAnotherCard,
		onRestart,
		onShare
	}: Props = $props();

	const shareLabel = $derived(
		sharing
			? 'กำลังสร้างรูป...'
			: shareResult === 'downloaded'
				? 'บันทึกรูปแล้ว'
				: shareResult === 'failed'
					? 'ลองใหม่อีกครั้ง'
					: shareResult === 'shared'
						? 'แชร์แล้ว'
						: 'แชร์เป็นรูป'
	);

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

	<!--
		Keyed on `version` so a re-roll re-creates these nodes and the reveal animation
		plays again. Without the key Svelte reuses the DOM and the new text just pops in.
	-->
	{#key version}
		<div
			class="reading mt-6 space-y-4 rounded-[var(--radius-card)] border border-[var(--line)]
				bg-[var(--bg-2)] px-5 py-6 transition-opacity duration-200 sm:px-7 sm:py-8
				{rerolling ? 'opacity-40' : ''}"
			style="box-shadow: var(--shadow)"
			aria-busy={rerolling}
		>
			{#each reading.lines as line, i (i)}
				<p class="font-display text-[var(--ink)]" style="animation-delay: {i * 140}ms">{line}</p>
			{/each}
		</div>
	{/key}

	<div class="mt-6 flex flex-wrap justify-center gap-3">
		<button
			type="button"
			onclick={onReroll}
			disabled={rerolling}
			class="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-ink)]
				transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-50"
		>
			{rerolling ? 'กำลังทำนายใหม่...' : 'ดูใหม่อีกรอบ'}
		</button>
		<button
			type="button"
			onclick={onAnotherCard}
			disabled={rerolling}
			class="rounded-full border border-[var(--line)] bg-[var(--bg-2)] px-5 py-3 text-sm
				font-semibold text-[var(--ink)] transition-colors enabled:hover:border-[var(--accent)]
				disabled:opacity-50"
		>
			เปิดไพ่ใบอื่น
		</button>
		<button
			type="button"
			onclick={onShare}
			disabled={sharing || rerolling}
			class="inline-flex items-center gap-2 rounded-full border border-[var(--line)]
				bg-[var(--bg-2)] px-5 py-3 text-sm font-semibold text-[var(--ink)] transition-colors
				enabled:hover:border-[var(--accent)] disabled:opacity-50"
		>
			<svg
				viewBox="0 0 24 24"
				class="h-4 w-4"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M12 16V4M12 4 8 8M12 4l4 4" />
				<path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
			</svg>
			{shareLabel}
		</button>
	</div>

	<!-- Restart is destructive relative to the other three, so it gets its own line
	     rather than sitting a tap away from them. -->
	<div class="mt-4 text-center">
		<button
			type="button"
			onclick={onRestart}
			class="text-sm font-medium text-[var(--ink-muted)] underline underline-offset-4
				transition-colors hover:text-[var(--ink)]"
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
