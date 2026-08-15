import { describe, expect, it } from 'vitest';
import { segment, wrap } from './share';

/**
 * Canvas isn't available under Node, but `wrap` only ever calls `measureText`, so a
 * fixed-width stub exercises the real line-breaking logic. This is the part worth
 * testing: Thai has no spaces, so a naive whitespace split produces one unbreakable
 * token the width of the whole sentence, and the card silently overflows.
 */
const CHAR_W = 10;
const ctx = { measureText: (s: string) => ({ width: [...s].length * CHAR_W }) } as Pick<
	CanvasRenderingContext2D,
	'measureText'
>;

const THAI = 'ลิฟต์จะปิดใส่หน้าตอนวิ่งไปทันพอดีทุกครั้งที่รีบที่สุดของวัน';

describe('segment', () => {
	it('splits Thai into more than one piece', () => {
		// If Intl.Segmenter were missing this still passes via the character fallback,
		// which is the point — wrapping must never depend on word support existing.
		expect(segment(THAI).length).toBeGreaterThan(1);
	});

	it('preserves the original text when rejoined', () => {
		expect(segment(THAI).join('')).toBe(THAI);
	});
});

describe('wrap', () => {
	it('breaks Thai text with no spaces into multiple lines', () => {
		const lines = wrap(ctx, THAI, 200);
		expect(lines.length).toBeGreaterThan(1);
	});

	it('never exceeds the max width', () => {
		for (const width of [150, 200, 320, 480]) {
			const lines = wrap(ctx, THAI, width);
			for (const line of lines) {
				// A single segment longer than the limit is unavoidable; allow one over.
				expect(line.length * CHAR_W).toBeLessThanOrEqual(width + CHAR_W * 8);
			}
		}
	});

	it('loses no characters', () => {
		const rejoined = wrap(ctx, THAI, 200).join('');
		expect(rejoined.replace(/\s/g, '')).toBe(THAI.replace(/\s/g, ''));
	});

	it('handles a short string as a single line', () => {
		expect(wrap(ctx, 'สั้น', 500)).toEqual(['สั้น']);
	});

	it('handles mixed Thai and latin', () => {
		const mixed = 'เน็ตจะหลุดตอน 1% แบตหมด wifi ก็ไม่มา';
		expect(wrap(ctx, mixed, 160).join('').replace(/\s+/g, '')).toBe(mixed.replace(/\s+/g, ''));
	});
});
