/**
 * Client side of the LLM path.
 *
 * Timing exploits gaps the flow already has:
 *
 *   route mount ──► warm-up ping        (model loads while Q1-Q3 are answered)
 *   wish submit ──► real request        (~1-3s warm, 30-60s cold)
 *   card flip   ──► display deadline    (use the line if it arrived, else the bank)
 *
 * The deadline is a *display* decision, not a network one: a late response is left
 * running because it will be ready for the re-roll. Nothing here ever blocks the
 * reading — a failure is silent and indistinguishable from the composer path.
 */

import { base } from '$app/paths';
import type { Category, Mode } from './types';

const ENDPOINT = `${base}/api/oracle`;

/** Hard ceiling. The display deadline is much shorter; this only stops a hang. */
const ABORT_MS = 60_000;

export interface OracleRequest {
	mode: Mode;
	category: Category;
	wish: string;
	subject: string;
	variant: number;
}

export type OracleOutcome =
	| { status: 'ready'; line: string }
	| { status: 'failed' }
	| { status: 'ratelimited' };

/**
 * Fire-and-forget warm-up. Contains no user text and its response is discarded —
 * the only job is getting the model onto a GPU before the user finishes the flow.
 * A low-traffic app is otherwise cold on almost every visit.
 */
export function warmUp(): void {
	void fetch(ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ warmup: true })
	}).catch(() => {
		// Warm-up failure is not worth reporting; the request path handles its own errors.
	});
}

export function requestLine(req: OracleRequest): {
	promise: Promise<OracleOutcome>;
	abort: () => void;
} {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), ABORT_MS);

	const promise = (async (): Promise<OracleOutcome> => {
		try {
			const res = await fetch(ENDPOINT, {
				method: 'POST',
				signal: controller.signal,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(req)
			});

			if (res.status === 429) return { status: 'ratelimited' };
			if (!res.ok) return { status: 'failed' };

			const data = await res.json();
			if (typeof data?.line === 'string' && data.line.trim()) {
				return { status: 'ready', line: data.line.trim() };
			}
			return { status: 'failed' };
		} catch {
			return { status: 'failed' };
		} finally {
			clearTimeout(timer);
		}
	})();

	return { promise, abort: () => controller.abort() };
}
