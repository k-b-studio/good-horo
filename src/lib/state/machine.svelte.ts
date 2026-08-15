/**
 * The single state machine that drives the whole app.
 *
 *   ASK_TARGET → ASK_AFFINITY? → MODE_REVEAL → ASK_WISH → PICK_CARD → FLIPPING → RESULT
 *
 * The flow is short and branching, so one object with explicit transitions is
 * clearer than screen-level component state. The LLM adds no states: its request is
 * fired during steps the user was already going to spend time on.
 */

import { compose } from '$lib/engine/compose';
import { requestLine, warmUp, type OracleOutcome } from '$lib/engine/oracle';
import { NoRepeatPicker } from '$lib/engine/rng';
import type { Affinity, Category, Mode, Reading, Session, Target } from '$lib/engine/types';

export type Step =
	| 'ASK_TARGET'
	| 'ASK_AFFINITY'
	| 'MODE_REVEAL'
	| 'ASK_WISH'
	| 'PICK_CARD'
	| 'FLIPPING'
	| 'RESULT';

export type OracleState = 'idle' | 'pending' | 'ready' | 'failed' | 'ratelimited';

/** Card flip animation. The display deadline sits at the end of it. */
const FLIP_MS = 1200;
/** Small grace past the flip — warm responses land in 1-3s, so this catches most. */
const GRACE_MS = 1500;
/** How long the mode transition holds before the wish prompt. */
const MODE_REVEAL_MS = 2200;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function emptySession(): Session {
	return {
		target: null,
		affinity: null,
		mode: null,
		category: null,
		freeText: '',
		chosenCardId: null
	};
}

export class Machine {
	step = $state<Step>('ASK_TARGET');
	session = $state<Session>(emptySession());
	reading = $state<Reading | null>(null);
	oracleState = $state<OracleState>('idle');
	copied = $state(false);

	/** Shared across re-rolls so consecutive readings don't repeat a line. */
	private picker = new NoRepeatPicker();
	private seed = Math.floor(Math.random() * 0xffffffff);
	private variant = 0;
	private oracleLine: string | null = null;
	private inFlight: { promise: Promise<OracleOutcome>; abort: () => void } | null = null;

	get mode(): Mode {
		return this.session.mode ?? 'heaven';
	}

	/** HEAVEN covers both "about me" (คุณ) and "about someone I like" (เขา). */
	get subject(): string {
		if (this.session.mode === 'hell') return 'เขา';
		return this.session.target === 'self' ? 'คุณ' : 'เขา';
	}

	/** Called once when the route mounts, to beat the 30-60s cold start. */
	start(): void {
		warmUp();
	}

	chooseTarget(target: Target): void {
		this.session.target = target;
		if (target === 'self') {
			this.resolveMode('heaven');
		} else {
			this.step = 'ASK_AFFINITY';
		}
	}

	chooseAffinity(affinity: Affinity): void {
		this.session.affinity = affinity;
		this.resolveMode(affinity === 'dislike' ? 'hell' : 'heaven');
	}

	private resolveMode(mode: Mode): void {
		this.session.mode = mode;
		// HELL carries its category in the free text; HEAVEN asks for one.
		this.session.category = mode === 'hell' ? null : this.session.category;
		this.step = 'MODE_REVEAL';
		void sleep(MODE_REVEAL_MS).then(() => {
			if (this.step === 'MODE_REVEAL') this.step = 'ASK_WISH';
		});
	}

	setCategory(category: Category): void {
		this.session.category = category;
	}

	setFreeText(text: string): void {
		this.session.freeText = text;
	}

	/** Fires the LLM request, then moves on — the user picks a card while it runs. */
	submitWish(): void {
		this.step = 'PICK_CARD';
		this.fireOracle();
	}

	private fireOracle(): void {
		this.inFlight?.abort();
		this.oracleLine = null;
		this.oracleState = 'pending';

		const handle = requestLine({
			mode: this.mode,
			category: this.session.category ?? 'life',
			wish: this.session.freeText,
			subject: this.subject,
			variant: this.variant
		});
		this.inFlight = handle;

		void handle.promise.then((outcome) => {
			if (this.inFlight !== handle) return; // superseded by a re-roll
			if (outcome.status === 'ready') {
				this.oracleLine = outcome.line;
				this.oracleState = 'ready';
			} else {
				this.oracleState = outcome.status === 'ratelimited' ? 'ratelimited' : 'failed';
			}
		});
	}

	async pickCard(cardId: string): Promise<void> {
		this.session.chosenCardId = cardId;
		this.step = 'FLIPPING';

		// The animation must play in full; the oracle gets whatever time that buys,
		// plus a short grace. Past that the bank line ships and the request is left
		// running — if it lands late it is ready for the re-roll.
		await sleep(FLIP_MS);
		if (this.oracleState === 'pending' && this.inFlight) {
			await Promise.race([this.inFlight.promise, sleep(GRACE_MS)]);
		}

		this.reading = compose(this.session, this.seed, {
			oracleLine: this.oracleLine,
			picker: this.picker
		});
		this.step = 'RESULT';
	}

	/** Same inputs, new text. Re-uses a late oracle line if one arrived meanwhile. */
	async reroll(): Promise<void> {
		this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
		this.variant += 1;
		this.copied = false;

		const carried = this.oracleLine;
		this.step = 'FLIPPING';
		this.fireOracle();

		await sleep(FLIP_MS);
		if (this.oracleState === 'pending' && this.inFlight) {
			await Promise.race([this.inFlight.promise, sleep(GRACE_MS)]);
		}

		this.reading = compose(this.session, this.seed, {
			oracleLine: this.oracleLine ?? carried,
			picker: this.picker
		});
		this.step = 'RESULT';
	}

	restart(): void {
		this.inFlight?.abort();
		this.inFlight = null;
		this.oracleLine = null;
		this.oracleState = 'idle';
		this.picker.reset();
		this.seed = Math.floor(Math.random() * 0xffffffff);
		this.variant = 0;
		this.copied = false;
		this.reading = null;
		this.session = emptySession();
		this.step = 'ASK_TARGET';
	}

	destroy(): void {
		this.inFlight?.abort();
		this.inFlight = null;
	}

	async copyReading(): Promise<void> {
		if (!this.reading) return;
		const text = `${this.reading.lines.join('\n')}\n\n— ดูดวงเข้าข้าง / kbstudio.space`;
		try {
			await navigator.clipboard.writeText(text);
			this.copied = true;
			setTimeout(() => (this.copied = false), 2000);
		} catch {
			// Clipboard can be blocked; the text is on screen either way.
		}
	}
}
