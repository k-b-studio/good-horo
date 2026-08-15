<script lang="ts">
	import type { Mode } from '$lib/engine/types';

	interface Props {
		mode: Mode;
	}

	let { mode }: Props = $props();

	const copy = {
		heaven: { title: 'โหมดลูกรักพระเจ้า', sub: 'จักรวาลอยู่ข้างคุณตั้งแต่ยังไม่ทันขอ' },
		hell: { title: 'โหมดอีเวรนั่น มึงเจอกู', sub: 'ยมบาลเปิดแฟ้มแล้ว' }
	} as const;
</script>

<!-- The app's best moment: heaven blooms open, hell burns in. -->
<div class="flex min-h-[60vh] flex-col items-center justify-center text-center" data-reveal={mode}>
	<div class="reveal-ring" aria-hidden="true"></div>
	<h2 class="font-display reveal-title text-3xl font-bold text-[var(--ink)] sm:text-5xl">
		{copy[mode].title}
	</h2>
	<p class="reveal-sub mt-4 text-base text-[var(--ink-muted)] sm:text-lg">{copy[mode].sub}</p>
</div>

<style>
	.reveal-ring {
		position: absolute;
		width: min(70vw, 26rem);
		aspect-ratio: 1;
		border-radius: 50%;
		pointer-events: none;
	}

	[data-reveal='heaven'] .reveal-ring {
		background: radial-gradient(circle, rgb(255 240 205 / 0.9) 0%, transparent 65%);
		animation: bloom 2.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	[data-reveal='hell'] .reveal-ring {
		background: radial-gradient(circle, rgb(226 82 31 / 0.55) 0%, transparent 60%);
		animation: burn 2.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
	}

	.reveal-title {
		animation: rise 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: 0.25s;
	}

	.reveal-sub {
		animation: rise 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: 0.5s;
	}

	@keyframes bloom {
		0% {
			transform: scale(0.2);
			opacity: 0;
		}
		55% {
			opacity: 1;
		}
		100% {
			transform: scale(1.6);
			opacity: 0.35;
		}
	}

	@keyframes burn {
		0% {
			transform: scale(1.7);
			opacity: 0;
		}
		30% {
			opacity: 1;
		}
		100% {
			transform: scale(0.9);
			opacity: 0.5;
		}
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	/* Reduced motion still needs the mode announced — it just arrives without theatre. */
	@media (prefers-reduced-motion: reduce) {
		.reveal-ring {
			opacity: 0.4;
		}
	}
</style>
