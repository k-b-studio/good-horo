/**
 * The five cards per mode.
 *
 * They must feel like a real choice — distinct name, illustration and flavour line.
 * But card identity changes the *flavour* of the text, never the verdict. That is
 * the whole joke: the user thinks they chose, and the universe agrees with them
 * anyway. `tone` steers which tagged bank lines the composer prefers; it can never
 * reach the polarity decision, which is fixed by mode before a card is picked.
 */

import type { Card } from '$lib/engine/types';

export const heavenCards: Card[] = [
	{
		id: 'h-star',
		mode: 'heaven',
		name: 'ดาวประทานพร',
		flavour: 'ใบที่ให้ก่อนถาม',
		tone: 'generous'
	},
	{
		id: 'h-gate',
		mode: 'heaven',
		name: 'ประตูสวรรค์',
		flavour: 'ใบที่เปิดทางให้',
		tone: 'opening'
	},
	{
		id: 'h-hand',
		mode: 'heaven',
		name: 'มือที่มองไม่เห็น',
		flavour: 'ใบที่ช่วยแบบไม่บอก',
		tone: 'quiet'
	},
	{
		id: 'h-dawn',
		mode: 'heaven',
		name: 'แสงสุดท้ายก่อนรุ่ง',
		flavour: 'ใบที่มาหลังความเหนื่อย',
		tone: 'earned'
	},
	{
		id: 'h-favourite',
		mode: 'heaven',
		name: 'ลูกรักตัวจริง',
		flavour: 'ใบที่จักรวาลลำเอียง',
		tone: 'spoiled'
	}
];

export const hellCards: Card[] = [
	{
		id: 'l-ledger',
		mode: 'hell',
		name: 'ยมบาลจดชื่อ',
		flavour: 'ใบที่บันทึกไว้แล้ว',
		tone: 'recorded'
	},
	{
		id: 'l-fire',
		mode: 'hell',
		name: 'ไฟไม่มีวันดับ',
		flavour: 'ใบที่ไม่รีบ แต่ไม่ลืม',
		tone: 'slow'
	},
	{
		id: 'l-karma',
		mode: 'hell',
		name: 'กรรมตามทัน (ด่วนพิเศษ)',
		flavour: 'ใบที่มาถึงก่อนกำหนด',
		tone: 'express'
	},
	{
		id: 'l-pot',
		mode: 'hell',
		name: 'หม้อต้มใบที่ 8',
		flavour: 'ใบที่ต้มช้าๆ',
		tone: 'simmer'
	},
	{
		id: 'l-book',
		mode: 'hell',
		name: 'บัญชีหนังหมา',
		flavour: 'ใบที่คิดดอกเบี้ย',
		tone: 'interest'
	}
];

export const cardsByMode = {
	heaven: heavenCards,
	hell: hellCards
} as const;
