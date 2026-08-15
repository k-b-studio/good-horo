/**
 * The slot-filling composer.
 *
 *   [OPENER] + [ECHO of the user's text] + [TIMING/ESCALATION] + [EXTRA] + [CLOSER]
 *
 * Pure and synchronous: same session + same seed => same reading. It never fetches.
 * When the LLM path succeeds, the caller passes its line in as `oracleLine` and it
 * substitutes for [EXTRA] — the one slot that benefits from knowing the user's
 * specific words. Every other slot stays mode-locked, which is what guarantees
 * polarity even if the model returns something off-target.
 *
 * The verdict is decided by `mode` before this function is called. Nothing here —
 * not the card, not the seed, not the LLM — can flip it.
 */

import {
	heavenClosers,
	heavenEchoFrames,
	heavenExtras,
	heavenGeneric,
	heavenOpeners,
	heavenTiming
} from '$lib/data/heaven';
import {
	hellClosers,
	hellEchoFrames,
	hellExtras,
	hellGeneric,
	hellOpeners,
	hellPivotFrames,
	hellTiming
} from '$lib/data/hell';
import { containsSevereHarm } from './guard';
import { normalizeWish } from './normalize';
import { hashSeed, mulberry32, NoRepeatPicker } from './rng';
import type { BankLine, Category, Reading, Session } from './types';

export interface ComposeOptions {
	/** Validated LLM line for the [EXTRA] slot. Omit or pass null to use the bank. */
	oracleLine?: string | null;
	/** Shared across re-rolls in a session so consecutive readings don't repeat. */
	picker?: NoRepeatPicker;
}

function resolveSubject(session: Session, rand: () => number): string {
	if (session.mode === 'hell') {
		// Alternate for tonal variety — อีนั่น lands harder, เขา keeps it from tiring.
		return rand() < 0.6 ? 'อีนั่น' : 'เขา';
	}
	return session.target === 'self' ? 'คุณ' : 'เขา';
}

function fill(text: string, subject: string, wish: string): string {
	return text
		.replaceAll('{{SUBJECT}}', subject)
		.replaceAll('{{WISH}}', wish)
		.replaceAll('{{CURSE}}', wish);
}

export function compose(session: Session, seed: number, options: ComposeOptions = {}): Reading {
	const mode = session.mode;
	if (!mode) throw new Error('compose() called before the mode was resolved');

	const category: Category = session.category ?? 'life';
	const picker = options.picker ?? new NoRepeatPicker();

	// Card identity perturbs the seed, so the five cards read differently while the
	// verdict stays fixed. Same card + same seed still reproduces exactly.
	const cardOffset = session.chosenCardId ? hashSeed(session.chosenCardId) : 0;
	const rand = mulberry32((seed ^ cardOffset) >>> 0);

	const subject = resolveSubject(session, rand);
	const wish = normalizeWish(session.freeText);

	// Severe input is never echoed back. In HELL that is a joke beat — the reading
	// pivots and offers something pettier. In HEAVEN there is nothing to pivot to,
	// so it simply falls through to a generic line.
	const severe = containsSevereHarm(session.freeText);
	const hasWish = wish.length > 0 && !severe;
	const pivoted = severe && mode === 'hell';

	const openers = mode === 'heaven' ? heavenOpeners : hellOpeners;
	const timings = mode === 'heaven' ? heavenTiming : hellTiming;
	const closers = mode === 'heaven' ? heavenClosers : hellClosers;
	const extras: BankLine[] = mode === 'heaven' ? heavenExtras[category] : hellExtras;

	let echoBank: BankLine[];
	if (pivoted) {
		echoBank = hellPivotFrames;
	} else if (hasWish) {
		echoBank = mode === 'heaven' ? heavenEchoFrames : hellEchoFrames;
	} else {
		echoBank = mode === 'heaven' ? heavenGeneric[category] : hellGeneric;
	}

	const opener = picker.pick('opener', openers, rand);
	const echo = picker.pick('echo', echoBank, rand);
	const timing = picker.pick('timing', timings, rand);
	const bankExtra = picker.pick('extra', extras, rand);
	const closer = picker.pick('closer', closers, rand);

	// A pivoted HELL reading always follows the pivot frame with a petty misfortune,
	// so the joke lands on a concrete image rather than on the refusal.
	const oracleLine = options.oracleLine?.trim();
	const oracleUsed = Boolean(oracleLine);
	const extraText = oracleUsed ? oracleLine! : fill(bankExtra.text, subject, wish);

	const lines = [
		fill(opener.text, subject, wish),
		fill(echo.text, subject, wish),
		fill(timing.text, subject, wish),
		extraText,
		fill(closer.text, subject, wish)
	];

	// Nothing with an unresolved token may reach the DOM. A bank line with a typo in
	// its placeholder should fail loudly in tests, not ship a literal "{{WISH}}".
	for (const line of lines) {
		if (line.includes('{{') || line.includes('}}')) {
			throw new Error(`unresolved token in composed line: ${line}`);
		}
	}

	const meter = mode === 'heaven' ? 97 + Math.floor(rand() * 4) : Math.floor(rand() * 4);

	return { lines, meter, pivoted, oracleUsed };
}
