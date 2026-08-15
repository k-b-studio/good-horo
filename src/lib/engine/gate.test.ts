import { describe, expect, it } from 'vitest';
import { gate } from './gate';
import { hellExtras } from '$lib/data/hell';

/**
 * Fixtures captured from the live ThaiLLM playground on 2026-08-14/15, verbatim.
 * Synthetic adversarial input would not have caught the unfenced English preamble,
 * which is the failure mode a <think> stripper misses entirely.
 */
const CAPTURED = {
	qwen36Preamble: `Here's a thinking process:

1.  **Analyze User Input:**
   - **Role:** Thai comedic fortune teller (หมอดูสายฮา)
   - **Language:** Thai (ภาษาไทย)
   - **Length:** Exactly 2 sentences (2 ประโยค)`,

	qwen35Preamble: `Thinking Process:

1.  **Analyze the Request:**
    *   **Role:** Thai funny fortune teller (หมอดูสายฮา), lazy/cynical style.
    *   **Constraints:** Thai language only, no introduction.`,

	openthaigptThink: `<think>
คำถามนี้ต้องการคำทำนายว่าไม่ชอบคน แต่คนไม่ชอบเรื่องนั้น จะโดนเรื่องซวยเล็กๆน้อยๆ ตามไปด้วย
</think>

ลิฟต์จะปิดใส่หน้าทุกครั้งที่รีบที่สุดของวัน`,

	typhoonEmoji: 'คนที่ไม่ชอบหน้าคนอื่น เจอเรื่องซวยเล็กๆ แล้ว "สอบตก" ชัดๆ! ฮาแอบกรี๊ด! 🔥😂🤦‍♀️',

	unclosedThink: '<think>\nกำลังคิดว่าจะเขียนอะไรดี แล้วงบ token ก็หมดก่อน',

	good: 'เน็ตจะหลุดทุกครั้งที่กำลังจะกดยืนยันคำตอบข้อสุดท้าย'
};

describe('gate — real captured failures', () => {
	it('rejects the unfenced English preamble from qwen3.6-35b-a3b', () => {
		const r = gate({ text: CAPTURED.qwen36Preamble, mode: 'hell' });
		expect(r.ok).toBe(false);
		expect(r.reason).toBe('preamble');
	});

	it('rejects the qwen3.5-9b preamble too', () => {
		const r = gate({ text: CAPTURED.qwen35Preamble, mode: 'hell' });
		expect(r.ok).toBe(false);
		expect(r.reason).toBe('preamble');
	});

	it('strips a closed <think> block and keeps the Thai that follows', () => {
		const r = gate({ text: CAPTURED.openthaigptThink, mode: 'hell' });
		expect(r.ok).toBe(true);
		expect(r.line).toBe('ลิฟต์จะปิดใส่หน้าทุกครั้งที่รีบที่สุดของวัน');
	});

	it('rejects an unclosed <think> — the budget ran out mid-reasoning', () => {
		const r = gate({ text: CAPTURED.unclosedThink, mode: 'hell' });
		expect(r.ok).toBe(false);
		expect(r.reason).toBe('not-thai');
	});

	it('still rejects the typhoon emoji line — on its remaining defects', () => {
		// Emoji alone no longer disqualify a line (they are stripped), so this fixture
		// now fails on what is actually wrong with it: it is three exclamations of
		// instruction-echo, not a fortune.
		const r = gate({ text: CAPTURED.typhoonEmoji, mode: 'hell' });
		expect(r.ok).toBe(false);
		expect(r.reason).toBe('too-many-sentences');
	});

	it('accepts a clean line', () => {
		const r = gate({ text: CAPTURED.good, mode: 'hell' });
		expect(r.ok).toBe(true);
		expect(r.line).toBe(CAPTURED.good);
	});
});

describe('gate — structural rejections', () => {
	it('rejects truncation before anything else', () => {
		const r = gate({ text: CAPTURED.good, mode: 'hell', finishReason: 'length' });
		expect(r.ok).toBe(false);
		expect(r.reason).toBe('truncated');
	});

	it.each([
		['', 'empty'],
		['   ', 'empty'],
		['สั้นไป', 'too-short'],
		['ก'.repeat(200), 'too-long']
	])('rejects %j as %s', (text, reason) => {
		expect(gate({ text, mode: 'hell' }).reason).toBe(reason);
	});

	it('rejects unresolved template tokens', () => {
		const r = gate({ text: 'จะเจอเรื่องซวยแบบ {{CURSE}} ทุกวันอังคาร', mode: 'hell' });
		expect(r.reason).toBe('unresolved-token');
	});

	it('rejects refusals', () => {
		const r = gate({ text: 'ขออภัย ฉันไม่สามารถเขียนคำแช่งให้ผู้อื่นได้นะครับ', mode: 'hell' });
		expect(r.reason).toBe('refusal');
	});

	it('rejects severe harm even when the user did not ask for it', () => {
		const r = gate({ text: 'เขาจะโดนรถชนตายภายในสัปดาห์นี้แน่นอน', mode: 'hell' });
		expect(r.reason).toBe('severe-harm');
	});

	it('rejects more than two sentences', () => {
		const r = gate({ text: 'เรื่องหนึ่งจะเกิดขึ้น. เรื่องสองจะตามมา. เรื่องสามก็ด้วย.', mode: 'hell' });
		expect(r.reason).toBe('too-many-sentences');
	});
});

describe('gate — polarity', () => {
	it('rejects negative drift in HEAVEN', () => {
		const r = gate({ text: 'ช่วงนี้ต้องระวังตัวให้มาก อาจจะผิดหวังได้ง่ายๆ', mode: 'heaven' });
		expect(r.reason).toBe('wrong-polarity');
	});

	it('rejects positive drift in HELL', () => {
		const r = gate({ text: 'ขอให้โชคดีและสมหวังในทุกเรื่องที่ตั้งใจไว้นะ', mode: 'hell' });
		expect(r.reason).toBe('wrong-polarity');
	});

	it('accepts a correctly-polarised line in each mode', () => {
		expect(gate({ text: 'เงินก้อนที่ไม่ได้วางแผนไว้จะโผล่มาแบบไม่ทันตั้งตัว', mode: 'heaven' }).ok).toBe(
			true
		);
		expect(gate({ text: 'ส้อมจะตกพื้นตอนอาหารเพิ่งมาเสิร์ฟพอดีทุกมื้อ', mode: 'hell' }).ok).toBe(true);
	});
});

describe('gate — bank copying', () => {
	it('rejects a line that parrots a bank exemplar', () => {
		const exemplar = hellExtras[0].text;
		const r = gate({
			text: exemplar,
			mode: 'hell',
			bankLines: hellExtras.map((l) => l.text)
		});
		expect(r.reason).toBe('bank-copy');
	});
});

describe('gate — cultural sensitivity', () => {
	it('rejects religious imagery in a curse', () => {
		const r = gate({ text: 'เขาจะเจอภาพพระพุทธรูปที่ชำรุดทุกครั้งที่เปิดโทรทัศน์', mode: 'hell' });
		expect(r.reason).toBe('severe-harm');
	});

	it('strips emoji instead of discarding an otherwise-good line', () => {
		const r = gate({ text: 'ส้อมจะตกพื้นตอนอาหารเพิ่งมาเสิร์ฟพอดีทุกมื้อ 🔥😂', mode: 'hell' });
		expect(r.ok).toBe(true);
		expect(r.line).toBe('ส้อมจะตกพื้นตอนอาหารเพิ่งมาเสิร์ฟพอดีทุกมื้อ');
	});
});
