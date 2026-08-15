<script lang="ts">
	import type { Category, Mode } from '$lib/engine/types';

	interface Props {
		mode: Mode;
		category: Category | null;
		freeText: string;
		onCategory: (c: Category) => void;
		onText: (t: string) => void;
		onSubmit: () => void;
	}

	let { mode, category, freeText, onCategory, onText, onSubmit }: Props = $props();

	const categories: { id: Category; label: string }[] = [
		{ id: 'love', label: 'ความรัก' },
		{ id: 'study', label: 'การเรียน' },
		{ id: 'work', label: 'การทำงาน' },
		{ id: 'life', label: 'ชีวิตทั่วไป' }
	];

	// HEAVEN needs a category first; HELL carries its topic in the free text alone.
	const ready = $derived(mode === 'hell' || category !== null);
</script>

<div class="mx-auto w-full max-w-xl">
	<h2 class="font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">
		{mode === 'heaven' ? 'อยากให้ดวงเรื่องนี้ออกมาเป็นยังไง' : 'คุณอยากให้อีนั่นโดนอะไรบ้าง'}
	</h2>

	{#if mode === 'heaven'}
		<div class="mt-5 flex flex-wrap gap-2">
			{#each categories as c (c.id)}
				<button
					type="button"
					onclick={() => onCategory(c.id)}
					aria-pressed={category === c.id}
					class="rounded-full border px-4 py-2 text-sm font-medium transition-colors
						{category === c.id
						? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
						: 'border-[var(--line)] bg-[var(--bg-2)] text-[var(--ink-muted)] hover:border-[var(--accent)]'}"
				>
					{c.label}
				</button>
			{/each}
		</div>
	{/if}

	<textarea
		value={freeText}
		oninput={(e) => onText(e.currentTarget.value)}
		rows="3"
		maxlength="200"
		placeholder={mode === 'heaven' ? 'เช่น อยากให้พี่เขาทักมาก่อน' : 'เช่น อยากให้เน็ตหลุดตอนพรีเซนต์'}
		class="mt-5 w-full resize-none rounded-[var(--radius-card)] border border-[var(--line)]
			bg-[var(--bg-2)] px-4 py-3 text-base text-[var(--ink)]
			placeholder:text-[var(--ink-muted)]/60
			focus:border-[var(--accent)] focus:outline-none"
	></textarea>

	<p class="mt-2 text-xs text-[var(--ink-muted)]">
		เว้นว่างไว้ก็ได้ — จักรวาลเลือกให้เอง
	</p>

	<!--
		Disclosure sits before submit, because submit is the moment the text leaves the
		device. The first draft of this app sent nothing anywhere; this one does.
	-->
	<p class="mt-1 text-xs text-[var(--ink-muted)]">
		ข้อความของคุณจะถูกส่งให้ AI ภาษาไทยช่วยแต่งคำทำนาย และไม่ถูกเก็บไว้
	</p>

	<button
		type="button"
		onclick={onSubmit}
		disabled={!ready}
		class="mt-6 w-full rounded-full bg-[var(--accent)] px-6 py-4 text-base font-semibold
			text-[var(--accent-ink)] transition-transform
			enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
	>
		{mode === 'heaven' ? 'เปิดไพ่' : 'เปิดไพ่ให้อีนั่น'}
	</button>
</div>
