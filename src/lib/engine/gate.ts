/**
 * Output gate for LLM-generated lines.
 *
 * Measured behaviour of the ThaiLLM playground models made this the most important
 * module in the LLM path:
 *
 *  - openthaigpt emits <think>...</think> blocks despite not being a "think" model
 *  - both Qwen models emit an *unfenced English* reasoning preamble, so a
 *    tag-stripper alone catches nothing — the Thai-ratio check is what stops them
 *  - typhoon emits emoji and occasionally echoes the instruction back
 *  - truncation at the token cap produces broken Thai mid-word
 *
 * Nothing reaches the DOM without passing every check. A rejection is not an error
 * state: the caller silently substitutes the bank line, which is indistinguishable
 * from success to anyone not watching the network tab.
 */

import { containsSevereHarm } from './guard';
import type { Mode } from './types';

export type GateReason =
	| 'ok'
	| 'empty'
	| 'truncated'
	| 'not-thai'
	| 'preamble'
	| 'emoji'
	| 'too-short'
	| 'too-long'
	| 'too-many-sentences'
	| 'unresolved-token'
	| 'refusal'
	| 'severe-harm'
	| 'wrong-polarity'
	| 'bank-copy';

export interface GateResult {
	ok: boolean;
	reason: GateReason;
	line: string;
}

const MIN_LEN = 15;
const MAX_LEN = 180;
const MIN_THAI_RATIO = 0.7;

/** Reasoning preambles observed live, plus generic markdown/list openers. */
const PREAMBLE = [
	/^here'?s?\s+a?\s*thinking/i,
	/^thinking\s+process/i,
	/^okay[,\s]/i,
	/^let'?s\s/i,
	/^\s*\d+[.)]\s/,
	/^\s*[-*•]\s/,
	/^\s*\*\*/,
	/^คำถามนี้/,
	/^ตัวอย่าง/,
	/^คำตอบ[:：]/,
	/^คำทำนาย[:：]/
];

const REFUSAL = [
	'ขออภัย',
	'ขอโทษ',
	'ไม่สามารถ',
	'ไม่เหมาะสม',
	'as an ai',
	'i cannot',
	"i can't",
	'i am unable',
	'sorry'
];

/** HEAVEN must not turn discouraging. Phrases, not bare negation — "ไม่ต้องทำอะไรเลย" is positive. */
const NEGATIVE_DRIFT = [
	'ไม่ได้ดั่งใจ',
	'ไม่สมหวัง',
	'อย่าหวัง',
	'ผิดหวัง',
	'ล้มเหลว',
	'โชคร้าย',
	'ซวย',
	'เสียใจ',
	'ระวังตัว',
	'ยากลำบาก',
	'อย่าเพิ่ง'
];

/** HELL must not turn encouraging. */
const POSITIVE_DRIFT = [
	'โชคดี',
	'สมหวัง',
	'สำเร็จ',
	'ร่ำรวย',
	'มีความสุข',
	'รุ่งเรือง',
	'ราบรื่น',
	'สมปรารถนา',
	'ขอให้โชค'
];

function thaiRatio(s: string): number {
	const chars = [...s].filter((c) => !/\s/u.test(c));
	if (chars.length === 0) return 0;
	const thai = chars.filter((c) => c >= '฀' && c <= '๿').length;
	return thai / chars.length;
}

function stripThink(s: string): string {
	let out = s.replace(/<think>[\s\S]*?<\/think>/gi, '');
	// An unclosed <think> means the budget ran out mid-reasoning: nothing usable follows.
	if (/<think>/i.test(out)) return '';
	// A stray closing tag means reasoning preceded it; keep only what comes after.
	const close = out.lastIndexOf('</think>');
	if (close !== -1) out = out.slice(close + '</think>'.length);
	return out.trim();
}

function countSentences(s: string): number {
	return s.split(/[.!?。！？\n]+/u).filter((p) => p.trim().length > 0).length;
}

export interface GateInput {
	text: string;
	mode: Mode;
	finishReason?: string | null;
	/** Bank lines for this mode, so the model can't win by parroting the exemplars. */
	bankLines?: readonly string[];
}

export function gate({ text, mode, finishReason, bankLines = [] }: GateInput): GateResult {
	const fail = (reason: GateReason): GateResult => ({ ok: false, reason, line: '' });

	// Truncation is checked before cleanup: a cut-off line reads as broken Thai even
	// if everything else about it is fine.
	if (finishReason === 'length') return fail('truncated');

	if (!text || !text.trim()) return fail('empty');

	let line = stripThink(text);
	if (!line) return fail('not-thai');

	// Collapse to a single line — the slot is one line by design.
	line = line
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean)
		.join(' ')
		.replace(/\s+/gu, ' ')
		.replace(/^["'“”‘’]+|["'“”‘’]+$/gu, '')
		.trim();

	// Emoji are a formatting problem, not a content one — typhoon adds them freely
	// despite being told not to. Stripping recovers an otherwise-good line; rejecting
	// would throw away roughly one usable response in six.
	line = line.replace(/\p{Extended_Pictographic}️?/gu, '').replace(/\s+/gu, ' ').trim();

	if (!line) return fail('empty');
	if (PREAMBLE.some((re) => re.test(line))) return fail('preamble');
	if (thaiRatio(line) < MIN_THAI_RATIO) return fail('not-thai');
	if (line.includes('{{') || line.includes('}}')) return fail('unresolved-token');
	if (line.length < MIN_LEN) return fail('too-short');
	if (line.length > MAX_LEN) return fail('too-long');
	if (countSentences(line) > 2) return fail('too-many-sentences');

	const lower = line.toLowerCase();
	if (REFUSAL.some((r) => lower.includes(r))) return fail('refusal');
	if (containsSevereHarm(line)) return fail('severe-harm');

	const drift = mode === 'heaven' ? NEGATIVE_DRIFT : POSITIVE_DRIFT;
	if (drift.some((d) => line.includes(d))) return fail('wrong-polarity');

	// Models reproduce their exemplars when the bank is used as few-shot material.
	if (bankLines.some((b) => b.length > 15 && line.includes(b))) return fail('bank-copy');

	return { ok: true, reason: 'ok', line };
}
