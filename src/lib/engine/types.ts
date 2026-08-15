export type Mode = 'heaven' | 'hell';
export type Target = 'self' | 'other';
export type Affinity = 'like' | 'dislike';
export type Category = 'love' | 'study' | 'work' | 'life';

/** Every bank entry is data, not code — lines can be added without touching logic. */
export interface BankLine {
	id: string;
	text: string;
	tags?: string[];
}

export interface Card {
	id: string;
	mode: Mode;
	name: string;
	flavour: string;
	/** Steers which tagged bank lines this card prefers. Flavour only — never the verdict. */
	tone: string;
}

export interface Session {
	target: Target | null;
	affinity: Affinity | null;
	mode: Mode | null;
	category: Category | null;
	freeText: string;
	chosenCardId: string | null;
}

export interface Reading {
	/** Assembled lines, in display order. */
	lines: string[];
	/** 97-100 in HEAVEN, 0-3 in HELL. Never anything between. */
	meter: number;
	/** True when the violent-input guard fired and swapped in a pivot frame. */
	pivoted: boolean;
	/** True when the [EXTRA] slot came from the LLM rather than the bank. */
	oracleUsed: boolean;
}
