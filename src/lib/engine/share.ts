/**
 * Renders a reading to a 1080x1920 JPEG for Instagram Stories.
 *
 * Drawn on a canvas rather than rasterised from the DOM: the output size is fixed
 * and has nothing to do with the viewport, there is no webfont-embedding step, and
 * it adds no dependency.
 *
 * The hard part is line breaking. Thai does not put spaces between words, so
 * splitting on whitespace produces one enormous unbreakable token. Intl.Segmenter
 * with a Thai locale gives real word boundaries (Safari 14.1+, Chrome 87+); older
 * engines fall back to breaking between characters, which is ugly but never
 * overflows.
 */

import type { Mode, Reading } from './types';

const W = 1080;
const H = 1920;
const PAD = 88;

interface Palette {
	bgFrom: string;
	bgTo: string;
	ink: string;
	muted: string;
	accent: string;
	panel: string;
}

const PALETTES: Record<Mode, Palette> = {
	heaven: {
		bgFrom: '#fffdf8',
		bgTo: '#f6e6c4',
		ink: '#4a3b28',
		muted: '#8c7a61',
		accent: '#b8862c',
		panel: 'rgba(255,255,255,0.62)'
	},
	hell: {
		bgFrom: '#1c1210',
		bgTo: '#080605',
		ink: '#f3e3d6',
		muted: '#a08674',
		accent: '#e2521f',
		panel: 'rgba(255,255,255,0.05)'
	}
};

/** Thai word boundaries where available, characters otherwise. Exported for tests. */
export function segment(text: string): string[] {
	try {
		if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
			const seg = new Intl.Segmenter('th', { granularity: 'word' });
			return Array.from(seg.segment(text), (s) => s.segment);
		}
	} catch {
		// Fall through to the character split.
	}
	return Array.from(text);
}

/** Exported for tests — only `measureText` is used, so a stub context suffices. */
export function wrap(
	ctx: Pick<CanvasRenderingContext2D, 'measureText'>,
	text: string,
	maxWidth: number
): string[] {
	const parts = segment(text);
	const lines: string[] = [];
	let current = '';

	for (const part of parts) {
		const next = current + part;
		if (current && ctx.measureText(next).width > maxWidth) {
			lines.push(current);
			// Never start a wrapped line with a space left over from the break.
			current = part.trimStart();
		} else {
			current = next;
		}
	}
	if (current.trim()) lines.push(current);
	return lines;
}

const displayFont = (size: number, weight = 600) =>
	`${weight} ${size}px 'Prompt', 'IBM Plex Sans Thai', sans-serif`;
const bodyFont = (size: number, weight = 400) =>
	`${weight} ${size}px 'IBM Plex Sans Thai', 'Prompt', sans-serif`;

/** Thai sample covering base glyphs, an upper vowel and a tone mark. */
const THAI_SAMPLE = 'ดูดวงที่ดี';
const LATIN_SAMPLE = 'kbstudio 0%';

/**
 * Force the exact faces into the document's font set before the canvas measures
 * anything.
 *
 * Fontsource ships `unicode-range`-subsetted files: the Thai subset is only fetched
 * when DOM text actually needs it, and `measureText` never triggers that fetch.
 * Without this, canvas measures Thai against fallback metrics — returning roughly
 * zero width — while still *drawing* it through a system Thai face. Text then
 * renders correctly but centres as though it were empty.
 *
 * `document.fonts.ready` is not sufficient: it resolves once *pending* loads settle,
 * and a face that was never requested is never pending. Passing sample text to
 * `load()` is what pulls in the right subset.
 */
async function ensureFonts(): Promise<void> {
	if (!('fonts' in document)) return;

	const faces = [
		[`400 32px 'IBM Plex Sans Thai'`, THAI_SAMPLE],
		[`500 32px 'IBM Plex Sans Thai'`, THAI_SAMPLE],
		[`600 32px 'Prompt'`, THAI_SAMPLE],
		[`700 32px 'Prompt'`, THAI_SAMPLE],
		[`600 32px 'Prompt'`, LATIN_SAMPLE],
		[`700 32px 'Prompt'`, LATIN_SAMPLE]
	] as const;

	await Promise.all(
		faces.map(([font, text]) => document.fonts.load(font, text).catch(() => undefined))
	);

	try {
		await document.fonts.ready;
	} catch {
		// Proceed with whatever resolved.
	}
}

/**
 * Centre by measuring and drawing from an explicit left origin, shrinking until the
 * text fits `maxWidth`. Doing the arithmetic here rather than leaning on
 * `textAlign = 'center'` keeps one alignment model in this file and makes overflow
 * impossible for the long footer and for unusually wide card names.
 */
function drawFitted(
	ctx: CanvasRenderingContext2D,
	text: string,
	centreX: number,
	y: number,
	maxWidth: number,
	font: (size: number) => string,
	size: number,
	minSize = 16
): void {
	let s = size;
	ctx.font = font(s);
	let w = ctx.measureText(text).width;

	while (w > maxWidth && s > minSize) {
		s -= 2;
		ctx.font = font(s);
		w = ctx.measureText(text).width;
	}

	ctx.fillText(text, centreX - w / 2, y);
}

interface Layout {
	fontSize: number;
	blocks: string[][];
	totalHeight: number;
}

/**
 * Shrink the reading until it fits the space left between header and footer. Five
 * slots of Thai can be short or very long depending on what the user typed.
 */
function fitReading(
	ctx: CanvasRenderingContext2D,
	lines: string[],
	maxWidth: number,
	maxHeight: number
): Layout {
	for (let fontSize = 46; fontSize >= 26; fontSize -= 2) {
		ctx.font = bodyFont(fontSize);
		const lh = Math.round(fontSize * 1.65);
		const gap = Math.round(fontSize * 0.85);
		const blocks = lines.map((l) => wrap(ctx, l, maxWidth));
		const total =
			blocks.reduce((sum, b) => sum + b.length * lh, 0) + gap * Math.max(0, blocks.length - 1);
		if (total <= maxHeight) return { fontSize, blocks, totalHeight: total };
	}

	ctx.font = bodyFont(26);
	const blocks = lines.map((l) => wrap(ctx, l, maxWidth));
	return { fontSize: 26, blocks, totalHeight: maxHeight };
}

export interface ShareCardInput {
	mode: Mode;
	reading: Reading;
	cardName: string | null;
}

export async function renderShareCard({
	mode,
	reading,
	cardName
}: ShareCardInput): Promise<Blob | null> {
	await ensureFonts();

	const canvas = document.createElement('canvas');
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;

	const p = PALETTES[mode];

	const bg = ctx.createLinearGradient(0, 0, 0, H);
	bg.addColorStop(0, p.bgFrom);
	bg.addColorStop(1, p.bgTo);
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, W, H);

	// Mode glow, echoing the on-screen theme.
	const glow = ctx.createRadialGradient(W / 2, 220, 40, W / 2, 220, 780);
	glow.addColorStop(0, mode === 'hell' ? 'rgba(226,82,31,0.34)' : 'rgba(255,225,160,0.75)');
	glow.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = glow;
	ctx.fillRect(0, 0, W, 1100);

	// One alignment model for the whole card: always draw from an explicit left
	// origin, and centre by arithmetic in drawFitted().
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';

	const cx = W / 2;
	const headerWidth = W - PAD * 2;
	let y = PAD + 70;

	ctx.fillStyle = p.muted;
	drawFitted(
		ctx,
		mode === 'heaven' ? 'โหมดลูกรักพระเจ้า' : 'โหมดอีเวรนั่น มึงเจอกู',
		cx,
		y,
		headerWidth,
		bodyFont,
		30
	);

	if (cardName) {
		y += 82;
		ctx.fillStyle = p.accent;
		drawFitted(ctx, cardName, cx, y, headerWidth, (s) => displayFont(s, 700), 54);
	}

	// Fortune meter — the number is the punchline, so it gets the largest type.
	y += 168;
	ctx.fillStyle = p.accent;
	drawFitted(ctx, `${reading.meter}%`, cx, y, headerWidth, (s) => displayFont(s, 700), 150);

	y += 54;
	ctx.fillStyle = p.muted;
	drawFitted(ctx, 'ระดับดวง', cx, y, headerWidth, bodyFont, 28);

	const panelTop = y + 66;
	const footerTop = H - PAD - 96;
	const panelHeight = footerTop - panelTop - 48;
	const innerPad = 56;
	const maxTextWidth = W - PAD * 2 - innerPad * 2;

	const layout = fitReading(ctx, reading.lines, maxTextWidth, panelHeight - innerPad * 2);

	ctx.fillStyle = p.panel;
	ctx.beginPath();
	ctx.roundRect(PAD, panelTop, W - PAD * 2, panelHeight, 40);
	ctx.fill();

	ctx.fillStyle = p.ink;
	ctx.font = bodyFont(layout.fontSize);

	const lh = Math.round(layout.fontSize * 1.65);
	const gap = Math.round(layout.fontSize * 0.85);
	let ty = panelTop + (panelHeight - layout.totalHeight) / 2 + lh * 0.75;

	for (const block of layout.blocks) {
		for (const line of block) {
			ctx.fillText(line, PAD + innerPad, ty);
			ty += lh;
		}
		ty += gap;
	}

	ctx.fillStyle = p.accent;
	drawFitted(
		ctx,
		'ดูดวงที่จริงใจได้ที่ · kbstudio.space/good-horoscope',
		cx,
		H - PAD - 46,
		headerWidth,
		(s) => displayFont(s, 600),
		30
	);

	ctx.fillStyle = p.muted;
	drawFitted(
		ctx,
		'สร้างมาเพื่อความบันเทิง โปรดใช้จัรกรยานในการรับชม',
		cx,
		H - PAD,
		headerWidth,
		bodyFont,
		24
	);

	return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92));
}

export type ShareOutcome = 'shared' | 'downloaded' | 'failed';

/**
 * Native share sheet where it exists — that is the path that reaches Instagram
 * Stories in one tap on a phone. Desktop browsers fall back to a download.
 */
export async function shareCard(input: ShareCardInput): Promise<ShareOutcome> {
	const blob = await renderShareCard(input);
	if (!blob) return 'failed';

	const file = new File([blob], 'good-horoscope.jpg', { type: 'image/jpeg' });

	if (navigator.canShare?.({ files: [file] })) {
		try {
			await navigator.share({ files: [file] });
			return 'shared';
		} catch (err) {
			// A user-cancelled share sheet is not an error, and must not fall through
			// to a surprise download.
			if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
		}
	}

	try {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'good-horoscope.jpg';
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
		return 'downloaded';
	} catch {
		return 'failed';
	}
}
