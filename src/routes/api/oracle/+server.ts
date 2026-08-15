/**
 * POST /good-horoscope/api/oracle
 *
 * The only server-side code in the app. It exists because browser-direct calls are
 * impossible: the ThaiLLM gateway sends no Access-Control-Allow-Origin header and
 * answers OPTIONS preflights with 400, so a preflighted POST never leaves the tab.
 * Keeping the key off the client is the second reason, not the first.
 *
 * Deliberately not a general LLM gateway — the client sends {mode, category, wish},
 * never a prompt, never a model.
 */

import { env } from '$env/dynamic/private';
import { json, type RequestHandler } from '@sveltejs/kit';
import { gate } from '$lib/engine/gate';
import { buildMessages, WARMUP_MESSAGES } from '$lib/engine/prompt';
import { hellExtras } from '$lib/data/hell';
import { heavenExtras } from '$lib/data/heaven';
import type { Category, Mode } from '$lib/engine/types';

export const prerender = false;

const UPSTREAM = 'https://thaillm.or.th/api/v1/chat/completions';

/**
 * Cloudflare fronts the gateway and 403s unrecognised user-agents — Python-urllib
 * was blocked outright in testing. Node's fetch sends a bare "node" UA, so this
 * header is load-bearing, not decoration.
 */
const USER_AGENT = 'kbstudio-horoscope/1.0';

/** openthaigpt measured 8/8 success at p50 1.8s; typhoon 6/8 with a 59s outlier. */
const PRIMARY_MODEL = env.ORACLE_MODEL || 'openthaigpt';
const FALLBACK_MODEL = 'typhoon';

/**
 * Generous on purpose. At 300 tokens, half of all live responses came back with
 * finish_reason "length" — openthaigpt rambles before it lands on a line, and a
 * truncated line reads as broken Thai. Latency is queue-dominated rather than
 * token-dominated, so a bigger budget costs far less time than it looks.
 */
const MAX_TOKENS = 800;
const UPSTREAM_TIMEOUT_MS = 55_000;
const MAX_BODY_BYTES = 1024;
const MAX_WISH_CHARS = 200;

const MODES: Mode[] = ['heaven', 'hell'];
const CATEGORIES: Category[] = ['love', 'study', 'work', 'life'];

/**
 * Token bucket sized under the shared upstream limit (5 req/s, 200 req/min per key
 * — not per user). Shedding here is better than forwarding a burst that would
 * 429 everyone using the same playground key.
 */
const RATE = { capacity: 3, refillPerSec: 2.5, tokens: 3, last: Date.now() };

function takeToken(): boolean {
	const now = Date.now();
	RATE.tokens = Math.min(RATE.capacity, RATE.tokens + ((now - RATE.last) / 1000) * RATE.refillPerSec);
	RATE.last = now;
	if (RATE.tokens < 1) return false;
	RATE.tokens -= 1;
	return true;
}

interface UpstreamResult {
	text: string;
	finishReason: string | null;
}

async function callUpstream(
	model: string,
	messages: { role: string; content: string }[],
	maxTokens: number,
	signal: AbortSignal
): Promise<UpstreamResult> {
	const res = await fetch(UPSTREAM, {
		method: 'POST',
		signal,
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${env.THAILLM_API_KEY}`,
			'User-Agent': USER_AGENT
		},
		body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 1.0 })
	});

	if (!res.ok) throw new Error(`upstream ${res.status}`);

	const data = await res.json();
	const choice = data?.choices?.[0];
	return {
		text: choice?.message?.content ?? '',
		finishReason: choice?.finish_reason ?? null
	};
}

export const POST: RequestHandler = async ({ request }) => {
	// Absent key => composer mode. The app is fully functional without this endpoint.
	if (!env.THAILLM_API_KEY || env.ORACLE_MODE === 'composer') {
		return json({ error: 'unavailable' }, { status: 503 });
	}

	// Same-origin check. Cheap and imperfect, but it filters casual reuse.
	const site = request.headers.get('sec-fetch-site');
	if (site && site !== 'same-origin' && site !== 'same-site') {
		return json({ error: 'unavailable' }, { status: 403 });
	}

	const raw = await request.text();
	if (raw.length > MAX_BODY_BYTES) {
		return json({ error: 'unavailable' }, { status: 413 });
	}

	let body: Record<string, unknown>;
	try {
		body = JSON.parse(raw);
	} catch {
		return json({ error: 'unavailable' }, { status: 400 });
	}

	if (!takeToken()) {
		return json({ error: 'ratelimited' }, { status: 429 });
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

	try {
		// Warm-up: a fixed 1-token throwaway that loads the model onto a GPU while the
		// user is still answering questions. Contains no user text, and the response
		// is discarded — a cold model costs 30-60s, which the flow cannot absorb.
		if (body.warmup === true) {
			await callUpstream(PRIMARY_MODEL, WARMUP_MESSAGES, 1, controller.signal).catch(() => null);
			return json({ ok: true });
		}

		const mode = body.mode as Mode;
		const category = (body.category as Category) ?? 'life';
		if (!MODES.includes(mode)) return json({ error: 'unavailable' }, { status: 400 });
		if (!CATEGORIES.includes(category)) return json({ error: 'unavailable' }, { status: 400 });

		const wish = typeof body.wish === 'string' ? body.wish.slice(0, MAX_WISH_CHARS) : '';
		const variant = Number.isInteger(body.variant) ? (body.variant as number) : 0;
		const subject = mode === 'hell' ? 'เขา' : typeof body.subject === 'string' ? body.subject : 'คุณ';

		const messages = buildMessages({ mode, category, wish, subject, variant });
		const bankLines = (mode === 'heaven' ? heavenExtras[category] : hellExtras).map((l) => l.text);

		let result: UpstreamResult | null = null;
		try {
			result = await callUpstream(PRIMARY_MODEL, messages, MAX_TOKENS, controller.signal);
		} catch {
			// One retry on a different model. 502s were 2/8 on typhoon, 0/8 on
			// openthaigpt; no retry on timeout, which would just double the wait.
			if (!controller.signal.aborted) {
				result = await callUpstream(FALLBACK_MODEL, messages, MAX_TOKENS, controller.signal).catch(
					() => null
				);
			}
		}

		if (!result) return json({ error: 'unavailable' }, { status: 502 });

		const verdict = gate({
			text: result.text,
			mode,
			finishReason: result.finishReason,
			bankLines
		});

		// Rejection is the normal path, not an error — the client silently uses its
		// bank line. The reason is returned for dev diagnostics only; user text is
		// never logged anywhere, in any environment.
		if (!verdict.ok) {
			return json({ error: 'unavailable', reason: verdict.reason }, { status: 200 });
		}

		return json({ line: verdict.line });
	} catch {
		return json({ error: 'unavailable' }, { status: 502 });
	} finally {
		clearTimeout(timer);
	}
};
