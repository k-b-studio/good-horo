<script lang="ts">
	import { onMount } from 'svelte';
	import AskWish from '$lib/components/AskWish.svelte';
	import Choice from '$lib/components/Choice.svelte';
	import ModeReveal from '$lib/components/ModeReveal.svelte';
	import PickCard from '$lib/components/PickCard.svelte';
	import Result from '$lib/components/Result.svelte';
	import { Machine } from '$lib/state/machine.svelte';

	const m = new Machine();

	onMount(() => {
		// Warm the model while the user answers Q1-Q3. A low-traffic app is otherwise
		// cold on almost every visit, and cold costs 30-60s.
		m.start();
		return () => m.destroy();
	});

	// Theme lives on this element only — never on <html> or <body> — so nothing can
	// leak into the host page when this route is proxied under kbstudio.space.
	const themeMode = $derived(m.session.mode ?? 'neutral');
	const showParticles = $derived(m.session.mode !== null);
</script>

<svelte:head>
	<title>ดูดวงเข้าข้าง — หมอดูที่อยู่ข้างคุณเสมอ</title>
	<meta
		name="description"
		content="เว็บดูดวงที่เข้าข้างคุณตั้งแต่คำถามแรก ไม่มีคำเตือน ไม่มีคำขู่ มีแต่ข่าวดี (ถ้าเป็นคุณ)"
	/>
	<!-- Absolute URLs: crawlers do not resolve relative paths, and the canonical home
	     is kbstudio.space even though the app is served from the good-horo project. -->
	<meta property="og:title" content="Good Horo" />
	<meta
		property="og:description"
		content="หมอดูที่อยู่ข้างคุณเสมอ — ไพ่ 5 ใบ เลือกใบไหนก็ได้ผลดีเหมือนกัน"
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://www.kbstudio.space/good-horoscope/" />
	<meta property="og:site_name" content="kbstudio.space" />
	<meta property="og:locale" content="th_TH" />
	<meta property="og:image" content="https://www.kbstudio.space/good-horoscope/og.jpg" />
	<meta property="og:image:type" content="image/jpeg" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="Good Horo — ดูดวงเข้าข้าง หมอดูที่อยู่ข้างคุณเสมอ" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Good Horo" />
	<meta
		name="twitter:description"
		content="หมอดูที่อยู่ข้างคุณเสมอ — ไพ่ 5 ใบ เลือกใบไหนก็ได้ผลดีเหมือนกัน"
	/>
	<meta name="twitter:image" content="https://www.kbstudio.space/good-horoscope/og.jpg" />
</svelte:head>

<div
	data-mode={themeMode}
	class="relative flex min-h-screen flex-col overflow-hidden bg-[var(--bg)] text-[var(--ink)]
		transition-colors duration-700"
>
	<div class="pointer-events-none absolute inset-0" style="background: var(--glow)"></div>

	{#if showParticles}
		<div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
			{#each Array.from({ length: 14 }, (_, i) => i) as i (i)}
				<span
					class="particle {themeMode === 'hell' ? 'ember' : 'light'}"
					style="left: {(i * 7.3) % 100}%; animation-delay: {i * 0.7}s; animation-duration: {9 +
						(i % 5) * 2}s"
				></span>
			{/each}
		</div>
	{/if}

	<header class="relative z-10 px-4 pt-5 sm:px-6">
		<a
			href="https://www.kbstudio.space/"
			class="text-xs text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
		>
			← kbstudio.space
		</a>
	</header>

	<main class="relative z-10 flex flex-1 items-center px-4 py-10 sm:px-6">
		<div class="mx-auto w-full max-w-3xl">
			{#if m.step === 'ASK_TARGET'}
				<div class="mx-auto w-full max-w-xl">
					<h1 class="font-display text-3xl font-bold sm:text-4xl">ดูดวงใคร?</h1>
					<p class="mt-2 text-sm text-[var(--ink-muted)]">เลือกก่อน แล้วจักรวาลจะจัดให้</p>
					<div class="mt-7 space-y-3">
						<Choice label="ตัวเอง" hint="ดูดวงให้ตัวคุณเอง" onclick={() => m.chooseTarget('self')} />
						<Choice label="คนอื่น" hint="ดูดวงให้คนที่คุณนึกถึงอยู่" onclick={() => m.chooseTarget('other')} />
					</div>
				</div>
			{:else if m.step === 'ASK_AFFINITY'}
				<div class="mx-auto w-full max-w-xl">
					<h1 class="font-display text-3xl font-bold sm:text-4xl">ชอบหน้าคนนั้นมั้ย?</h1>
					<p class="mt-2 text-sm text-[var(--ink-muted)]">ตอบตามตรง ไม่มีใครรู้</p>
					<div class="mt-7 space-y-3">
						<Choice label="ชอบ / เฉยๆ" onclick={() => m.chooseAffinity('like')} />
						<Choice label="ไม่ชอบหน้า" onclick={() => m.chooseAffinity('dislike')} />
					</div>
				</div>
			{:else if m.step === 'MODE_REVEAL'}
				<ModeReveal mode={m.mode} />
			{:else if m.step === 'ASK_WISH'}
				<AskWish
					mode={m.mode}
					category={m.session.category}
					freeText={m.session.freeText}
					onCategory={(c) => m.setCategory(c)}
					onText={(t) => m.setFreeText(t)}
					onSubmit={() => m.submitWish()}
				/>
			{:else if m.step === 'PICK_CARD' || m.step === 'FLIPPING'}
				<PickCard
					mode={m.mode}
					flipping={m.step === 'FLIPPING'}
					chosenId={m.session.chosenCardId}
					onPick={(id) => m.pickCard(id)}
				/>
			{:else if m.step === 'RESULT' && m.reading}
				<Result
					mode={m.mode}
					reading={m.reading}
					chosenId={m.session.chosenCardId}
					rerolling={m.rerolling}
					sharing={m.sharing}
					shareResult={m.shareResult}
					version={m.readingVersion}
					onReroll={() => m.reroll()}
					onAnotherCard={() => m.pickAnotherCard()}
					onRestart={() => m.restart()}
					onShare={() => m.share()}
				/>
			{/if}
		</div>
	</main>

	<footer class="relative z-10 px-4 pb-6 text-center sm:px-6">
		<p class="text-[0.7rem] text-[var(--ink-muted)]">
			แอปนี้สร้างมาเพื่อความบันเทิง โปรดใช้จักรยานในการรับชม
		</p>
	</footer>
</div>

<style>
	.particle {
		position: absolute;
		bottom: -10%;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		animation-name: drift;
		animation-timing-function: linear;
		animation-iteration-count: infinite;
	}

	.light {
		background: rgb(255 240 200 / 0.9);
		box-shadow: 0 0 8px rgb(255 230 170 / 0.8);
	}

	.ember {
		background: rgb(255 140 60 / 0.9);
		box-shadow: 0 0 10px rgb(255 90 20 / 0.9);
	}

	@keyframes drift {
		from {
			transform: translateY(0) translateX(0);
			opacity: 0;
		}
		15% {
			opacity: 1;
		}
		85% {
			opacity: 1;
		}
		to {
			transform: translateY(-110vh) translateX(24px);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.particle {
			display: none;
		}
	}
</style>
