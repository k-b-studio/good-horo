<script lang="ts">
	import { cardsByMode } from '$lib/data/cards';
	import type { Mode } from '$lib/engine/types';

	interface Props {
		mode: Mode;
		flipping: boolean;
		chosenId: string | null;
		onPick: (id: string) => void;
	}

	let { mode, flipping, chosenId, onPick }: Props = $props();

	const cards = $derived(cardsByMode[mode]);
</script>

<div class="mx-auto w-full max-w-3xl text-center">
	<h2 class="font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">
		{flipping ? 'กำลังเปิดไพ่...' : 'เลือกไพ่หนึ่งใบ'}
	</h2>
	<p class="mt-2 text-sm text-[var(--ink-muted)]">
		{flipping ? 'จักรวาลกำลังอ่าน' : 'ใบไหนก็ได้ ตามที่ใจเรียก'}
	</p>

	<div class="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
		{#each cards as card, i (card.id)}
			{@const isChosen = chosenId === card.id}
			<button
				type="button"
				disabled={flipping}
				onclick={() => onPick(card.id)}
				class="card-slot group relative aspect-[2/3] rounded-[var(--radius-card)]
					transition-all duration-300 disabled:cursor-default
					{flipping && !isChosen ? 'scale-95 opacity-25' : ''}
					{!flipping ? 'hover:-translate-y-2' : ''}"
				style="animation-delay: {i * 90}ms"
				aria-label={card.name}
			>
				<span
					class="card-inner block h-full w-full rounded-[var(--radius-card)]
						border border-[var(--line)] {isChosen && flipping ? 'is-flipping' : ''}"
					style="background: var(--card-back); box-shadow: var(--shadow)"
				>
					<span
						class="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center"
					>
						<span class="font-display text-sm font-semibold text-[var(--ink)] sm:text-base">
							{card.name}
						</span>
						<span class="text-[0.7rem] leading-tight text-[var(--ink-muted)]">
							{card.flavour}
						</span>
					</span>
				</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.card-slot {
		animation: deal 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.card-inner {
		transform-style: preserve-3d;
		transition: transform 0.3s ease;
	}

	.is-flipping {
		animation: flip 1.2s cubic-bezier(0.45, 0, 0.2, 1) forwards;
	}

	@keyframes deal {
		from {
			opacity: 0;
			transform: translateY(24px) rotate(-4deg);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@keyframes flip {
		0% {
			transform: rotateY(0deg) scale(1);
		}
		50% {
			transform: rotateY(90deg) scale(1.06);
		}
		100% {
			transform: rotateY(180deg) scale(1);
		}
	}
</style>
