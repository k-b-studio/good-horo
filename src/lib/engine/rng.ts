/**
 * Seeded PRNG + no-repeat picker.
 *
 * The composer must be deterministic given a seed so it can be unit-tested and so
 * re-roll is trivially "same session, new seed". mulberry32 is 4 lines, has a full
 * 2^32 period, and passes well enough for picking sentences out of a list.
 */

export function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return function () {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Cheap string hash so a seed can be derived from session content when needed. */
export function hashSeed(input: string): number {
	let h = 2166136261;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

/**
 * Picks from a list while avoiding the last N choices for that slot.
 *
 * Session-only, in-memory: consecutive re-rolls should not repeat a line, but there
 * is no persistence requirement and nothing here survives a reload.
 */
export class NoRepeatPicker {
	private history = new Map<string, string[]>();

	constructor(private readonly memory = 4) {}

	pick<T extends { id: string }>(slot: string, items: readonly T[], rand: () => number): T {
		if (items.length === 0) throw new Error(`empty bank for slot "${slot}"`);

		const recent = this.history.get(slot) ?? [];
		// Never filter the pool down to nothing — a small bank just repeats sooner.
		const pool = items.filter((i) => !recent.includes(i.id));
		const from = pool.length > 0 ? pool : items;
		const chosen = from[Math.floor(rand() * from.length)];

		const next = [...recent, chosen.id];
		this.history.set(slot, next.slice(-Math.min(this.memory, items.length - 1 || 1)));
		return chosen;
	}

	reset(): void {
		this.history.clear();
	}
}
