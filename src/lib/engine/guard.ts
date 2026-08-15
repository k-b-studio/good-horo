/**
 * Content guard for HELL mode.
 *
 * The register is petty cosmic inconvenience, not malice — curses should ruin a
 * Tuesday, not a life. This is a comedy decision before it is a safety one: petty
 * is funnier than cruel, and it is what makes a reading screenshot-and-send-able.
 *
 * When a user types something genuinely violent, the composer must not echo it
 * back. Instead the reading pivots — "จักรวาลปฏิเสธคำขอนี้ แต่ขอเสนอทางเลือกที่เจ็บกว่า" —
 * and continues into a petty-misfortune line. It is a joke beat, not a lecture.
 *
 * The same denylist is applied to LLM output in gate.ts, because a model can
 * produce this material even when the user did not ask for it.
 */

/**
 * Deliberately small and deliberately blunt. Thai has no word boundaries, so these
 * are substring matches — terms are chosen to be unlikely as innocent fragments.
 */
const SEVERE = [
	// Death. Bare "ตาย" is included deliberately: in a curse field it nearly always
	// means death, and the cost of a false positive is a pivot frame — which is a
	// joke beat, not an error. Missing it would echo "ให้มันตาย" back verbatim.
	'ตาย',
	'ฆ่า',
	'ฆาตกร',
	'ศพ',
	'ฝังศพ',
	'แขวนคอ',
	'ฆ่าตัวตาย',
	// injury / violence
	'ทำร้าย',
	'ตบหน้า',
	'ต่อย',
	'แทง',
	'ยิง',
	'ระเบิด',
	'รถชน',
	'พิการ',
	'เลือดออก',
	'หักคอ',
	// illness
	'มะเร็ง',
	'เอดส์',
	'โรคร้าย',
	'ป่วยหนัก',
	'เข้าโรงพยาบาล',
	// sexual
	'ข่มขืน',
	'อนาจาร',
	'เปลือย',
	// family / protected characteristics
	'พ่อแม่ตาย',
	'ครอบครัวพัง',
	'ลูกตาย',

	// Religion and monarchy. Added after a live model produced a curse involving a
	// พระพุทธรูป — in a Thai audience that is not edgy, it is just offensive, and
	// lèse-majesté makes the royal terms a legal matter rather than a taste one.
	'พระพุทธ',
	'พระสงฆ์',
	'พระภิกษุ',
	'วัดวาอาราม',
	'ศาสนา',
	'ในหลวง',
	'พระราชา',
	'ราชวงศ์',
	'พระบรม',
	'เจ้าฟ้า'
];

/** English equivalents — cheap to include, and the wish field is free text. */
const SEVERE_EN = [
	'kill',
	'die',
	'death',
	'murder',
	'suicide',
	'rape',
	'cancer',
	'stab',
	'shoot',
	'bomb'
];

export function containsSevereHarm(text: string): boolean {
	if (!text) return false;
	const lower = text.toLowerCase();
	return SEVERE.some((t) => text.includes(t)) || SEVERE_EN.some((t) => lower.includes(t));
}
