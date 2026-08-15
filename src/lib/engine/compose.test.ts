import { describe, expect, it } from 'vitest';
import { compose } from './compose';
import { normalizeWish } from './normalize';
import { NoRepeatPicker } from './rng';
import type { Session } from './types';
import * as heaven from '$lib/data/heaven';
import * as hell from '$lib/data/hell';

function session(over: Partial<Session> = {}): Session {
	return {
		target: 'self',
		affinity: null,
		mode: 'heaven',
		category: 'life',
		freeText: '',
		chosenCardId: 'h-star',
		...over
	};
}

/** Bank text with the placeholders stripped, so a filled line can be matched back. */
function fragments(lines: { text: string }[]): string[] {
	return lines.flatMap((l) =>
		l.text
			.split(/\{\{[A-Z]+\}\}/)
			.map((s) => s.trim())
			.filter((s) => s.length >= 12)
	);
}

/**
 * Some phrasing is intentionally shared between the two banks ("จักรวาลอ่านคำว่า ...").
 * A shared fragment is not evidence of leakage, so it is excluded from both sides —
 * only text unique to one mode can prove contamination.
 */
function exclusive(a: string[], b: string[]): string[] {
	const other = new Set(b);
	return a.filter((f) => !other.has(f));
}

const HEAVEN_ALL = fragments([
	...heaven.heavenOpeners,
	...heaven.heavenEchoFrames,
	...heaven.heavenTiming,
	...heaven.heavenClosers,
	...Object.values(heaven.heavenExtras).flat(),
	...Object.values(heaven.heavenGeneric).flat()
]);

const HELL_ALL = fragments([
	...hell.hellOpeners,
	...hell.hellEchoFrames,
	...hell.hellTiming,
	...hell.hellClosers,
	...hell.hellExtras,
	...hell.hellGeneric,
	...hell.hellPivotFrames
]);

const HEAVEN_FRAGMENTS = exclusive(HEAVEN_ALL, HELL_ALL);
const HELL_FRAGMENTS = exclusive(HELL_ALL, HEAVEN_ALL);

describe('polarity', () => {
	it('produces 200 HEAVEN readings with zero HELL bank leakage', () => {
		const picker = new NoRepeatPicker();
		for (let seed = 0; seed < 200; seed++) {
			const r = compose(session({ freeText: 'อยากให้สอบผ่านครับ', category: 'study' }), seed, {
				picker
			});
			const joined = r.lines.join(' ');
			const leaked = HELL_FRAGMENTS.filter((f) => joined.includes(f));
			expect(leaked, `seed ${seed} leaked hell lines`).toEqual([]);
			expect(r.meter).toBeGreaterThanOrEqual(97);
			expect(r.meter).toBeLessThanOrEqual(100);
		}
	});

	it('produces 200 HELL readings with zero HEAVEN bank leakage', () => {
		const picker = new NoRepeatPicker();
		for (let seed = 0; seed < 200; seed++) {
			const r = compose(
				session({
					mode: 'hell',
					target: 'other',
					affinity: 'dislike',
					category: null,
					chosenCardId: 'l-fire',
					freeText: 'อยากให้เน็ตหลุดตอนประชุม'
				}),
				seed,
				{ picker }
			);
			const joined = r.lines.join(' ');
			const leaked = HEAVEN_FRAGMENTS.filter((f) => joined.includes(f));
			expect(leaked, `seed ${seed} leaked heaven lines`).toEqual([]);
			expect(r.meter).toBeGreaterThanOrEqual(0);
			expect(r.meter).toBeLessThanOrEqual(3);
		}
	});
});

describe('determinism and variety', () => {
	it('is deterministic given the same seed', () => {
		const s = session({ freeText: 'อยากให้ได้เกรดเอ' });
		expect(compose(s, 4242).lines).toEqual(compose(s, 4242).lines);
	});

	it('keeps exact duplicates under 5% across 200 seeds with fixed input', () => {
		const s = session({ freeText: 'อยากให้พี่เขาทักมาก่อน', category: 'love' });
		const seen = new Set<string>();
		let dupes = 0;
		for (let seed = 0; seed < 200; seed++) {
			const key = compose(s, seed).lines.join('|');
			if (seen.has(key)) dupes++;
			seen.add(key);
		}
		expect(dupes / 200).toBeLessThan(0.05);
	});

	it('gives all five cards different text for the same seed and same verdict', () => {
		const ids = ['h-star', 'h-gate', 'h-hand', 'h-dawn', 'h-favourite'];
		const texts = ids.map((id) => compose(session({ chosenCardId: id }), 99).lines.join('|'));
		expect(new Set(texts).size).toBe(ids.length);
		for (const id of ids) {
			expect(compose(session({ chosenCardId: id }), 99).meter).toBeGreaterThanOrEqual(97);
		}
	});
});

describe('echo and normalisation', () => {
	it('strips intent markers and trailing particles', () => {
		expect(normalizeWish('อยากให้พี่เขาทักมาก่อนครับ')).toBe('พี่เขาทักมาก่อน');
		expect(normalizeWish('ขอให้สอบผ่านนะ')).toBe('สอบผ่าน');
		expect(normalizeWish('  อยากได้เงินเดือนขึ้นด้วย  ')).toBe('เงินเดือนขึ้น');
	});

	it('echoes the normalised phrase inside a frame', () => {
		const r = compose(session({ freeText: 'อยากให้พี่เขาทักมาก่อนครับ', category: 'love' }), 7);
		expect(r.lines.join(' ')).toContain('พี่เขาทักมาก่อน');
	});

	it('never renders an unresolved token, including on empty input', () => {
		for (let seed = 0; seed < 100; seed++) {
			const empty = compose(session({ freeText: '' }), seed).lines.join(' ');
			expect(empty).not.toContain('{{');
			const hellEmpty = compose(
				session({ mode: 'hell', category: null, freeText: '', chosenCardId: 'l-pot' }),
				seed
			).lines.join(' ');
			expect(hellEmpty).not.toContain('{{');
		}
	});

	it('falls through to a generic line when the field is blank', () => {
		const r = compose(session({ freeText: '   ' }), 11);
		const genericTexts = heaven.heavenGeneric.life.map((l) => l.text.replaceAll('{{SUBJECT}}', 'คุณ'));
		expect(genericTexts.some((g) => r.lines.includes(g))).toBe(true);
	});
});

describe('severe-harm guard', () => {
	it('does not echo violent input and fires the pivot frame in HELL', () => {
		const violent = 'อยากให้มันโดนรถชนตาย';
		const r = compose(
			session({ mode: 'hell', category: null, freeText: violent, chosenCardId: 'l-karma' }),
			3
		);
		const joined = r.lines.join(' ');
		expect(joined).not.toContain('รถชน');
		expect(r.pivoted).toBe(true);
		const pivots = hell.hellPivotFrames.map((p) => p.text.replaceAll('{{SUBJECT}}', 'อีนั่น'));
		expect(pivots.some((p) => r.lines.includes(p))).toBe(true);
	});

	it('does not echo violent input in HEAVEN either', () => {
		const r = compose(session({ freeText: 'อยากให้ศัตรูตาย' }), 5);
		expect(r.lines.join(' ')).not.toContain('ตาย');
		expect(r.pivoted).toBe(false);
	});
});

describe('oracle line substitution', () => {
	it('replaces the [EXTRA] slot and reports oracleUsed', () => {
		const line = 'จะเจอไฟแดงทุกแยกที่รีบที่สุด';
		const r = compose(session({ mode: 'hell', category: null, chosenCardId: 'l-book' }), 21, {
			oracleLine: line
		});
		expect(r.lines[3]).toBe(line);
		expect(r.oracleUsed).toBe(true);
	});

	it('keeps the frame mode-locked even when the oracle line is off-target', () => {
		const r = compose(session({ chosenCardId: 'h-dawn' }), 31, { oracleLine: 'ข้อความแปลกปลอม' });
		expect(r.meter).toBeGreaterThanOrEqual(97);
		const leaked = HELL_FRAGMENTS.filter((f) => r.lines.join(' ').includes(f));
		expect(leaked).toEqual([]);
	});

	it('falls back to the bank when no oracle line is supplied', () => {
		const r = compose(session(), 12, { oracleLine: null });
		expect(r.oracleUsed).toBe(false);
	});
});
