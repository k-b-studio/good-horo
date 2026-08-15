/**
 * Thai text cleanup for the ECHO slot.
 *
 * Verbatim echo works in Thai because there is no verb conjugation, no noun
 * inflection and no subject-verb agreement — a user phrase drops into a template
 * slot unchanged and still reads naturally. All this module has to do is strip the
 * intent framing the user wrapped around it ("อยากให้...ครับ") so the frame's own
 * wording doesn't collide with theirs.
 *
 * Regex rules only. No NLP, no word segmentation, no dependencies.
 */

const MAX_ECHO = 120;

/** Leading intent markers, longest first so "อยากให้" wins over "อยาก". */
const LEADING = [
	'ช่วยให้',
	'อยากได้',
	'อยากให้',
	'ขอให้',
	'อยาก',
	'ขอ',
	'ให้',
	'ต้องการ',
	'หวังว่า',
	'หวังให้'
];

/** Trailing politeness particles and softeners. */
const TRAILING = [
	'ครับผม',
	'ครับ',
	'คร้าบ',
	'ค่ะ',
	'คะ',
	'ค้าบ',
	'จ้า',
	'จ้ะ',
	'นะ',
	'น่ะ',
	'ด้วย',
	'หน่อย',
	'เลย',
	'อ่ะ',
	'อะ',
	'ที'
];

function stripLeading(s: string): string {
	let out = s;
	let changed = true;
	// Loop: "อยากให้ขอให้..." and similar stacked markers are common in real input.
	while (changed) {
		changed = false;
		for (const m of LEADING) {
			if (out.startsWith(m)) {
				out = out.slice(m.length).trimStart();
				changed = true;
				break;
			}
		}
	}
	return out;
}

function stripTrailing(s: string): string {
	let out = s;
	let changed = true;
	while (changed) {
		changed = false;
		out = out.replace(/[\s.!?…"'’”๏๚๛]+$/u, '');
		for (const p of TRAILING) {
			if (out.endsWith(p)) {
				out = out.slice(0, -p.length).trimEnd();
				changed = true;
				break;
			}
		}
	}
	return out;
}

/**
 * Truncate long input at a clause boundary so the surrounding ECHO frame still
 * reads as a sentence. Thai has no spaces between words, so the only safe split
 * points are explicit separators the user typed themselves.
 */
function clampLength(s: string): string {
	if (s.length <= MAX_ECHO) return s;

	const head = s.slice(0, MAX_ECHO);
	const boundary = Math.max(
		head.lastIndexOf(' '),
		head.lastIndexOf(','),
		head.lastIndexOf('และ'),
		head.lastIndexOf('แล้วก็'),
		head.lastIndexOf('กับ')
	);
	// Only honour a boundary in the last third, otherwise we throw away too much.
	const cut = boundary > MAX_ECHO * 0.6 ? boundary : MAX_ECHO;
	return s.slice(0, cut).trimEnd() + '...';
}

/**
 * @returns the echo-ready phrase, or '' when there is nothing usable left — the
 * caller falls through to a generic bank line rather than rendering an empty slot.
 */
export function normalizeWish(raw: string): string {
	if (!raw) return '';

	let s = raw.replace(/\s+/gu, ' ').trim();
	s = stripLeading(s);
	s = stripTrailing(s);
	s = clampLength(s);

	// A leftover of one or two characters is noise, not a wish.
	return s.length >= 2 ? s : '';
}
