# Biased Horoscope App (ดูดวงเข้าข้างผู้ใช้)

## Goal

A joke horoscope web app built on a single premise: real horoscope sites make people feel bad, so this one is structurally incapable of doing that. The reading is rigged from the moment the user answers the first question. If the reading is about the user (or someone they like), every card is a blessing. If it's about someone they dislike, every card is a curse. The user's own typed words are fed back to them as the "prophecy."

All UI and content is Thai. This is comedy software — it is not meant to be taken seriously, and the app should say so.

## Deployment context

- **Lives at** `https://www.kbstudio.space/good-horoscope`
- **Host site** `kbstudio.space` is an existing Vercel deployment with an app directory/index on the landing page. There is **one empty slot** in that directory, which this app fills.
- This is therefore **a new route inside the existing repo**, not a standalone project. Do not scaffold a fresh app — read the repo's existing structure, framework, styling convention, and directory-data source first, then add the route in the way the repo already does things.
- **Directory entry is part of the deliverable.** Adding the route is not "done" until the empty slot on the landing page links to it with a title, a one-line Thai description, and whatever thumbnail/icon the other entries use. Match the existing entries' data shape exactly.
- **Static only.** No serverless functions, no API routes, no environment variables, no database. The whole app is client-side, so the Vercel deployment stays free and the zero-cost requirement holds all the way to production.
- **Note on the slug:** the URL says `good-horoscope`, but half the app is HELL mode. "Good" here means *good to you* (เข้าข้างผู้ใช้), not *nice*. Keep the slug; it's fine, and it makes the hell mode a better surprise.

## Requirements

### Flow

1. **Q1 — ดูดวงใคร?** → `ตัวเอง` / `คนอื่น`
2. **Q2 (only if `คนอื่น`) — ชอบหน้าคนนั้นมั้ย?** → `ชอบ / เฉยๆ` / `ไม่ชอบหน้า`
3. **Mode resolution**
   - `ตัวเอง` OR `คนอื่น + ชอบ/เฉยๆ` → **โหมดลูกรักพระเจ้า** (HEAVEN)
   - `คนอื่น + ไม่ชอบหน้า` → **โหมดอีเวรนั่น มึงเจอกู** (HELL)
4. **Mode transition animation**, then the entire UI theme swaps (see Visual design).
5. **Q3 — the wish/curse prompt**, wording depends on mode.
   - HEAVEN: pick a category (ความรัก / การเรียน / การทำงาน / ชีวิตทั่วไป), then free-text: *"อยากให้ดวงเรื่องนี้ออกมาเป็นยังไง"*
   - HELL: free-text only: *"คุณอยากให้อีนั่นโดนอะไรบ้าง"*
6. **Card selection** — 5 face-down cards, user picks one.
7. **Reveal** — flip animation, then the generated reading.
8. **Actions** — `ดูใหม่อีกรอบ` (re-roll, same inputs, different text), `เริ่มใหม่ทั้งหมด`, `คัดลอกคำทำนาย`.

### The rigged verdict

- In HEAVEN, all 5 cards produce a granted wish. In HELL, all 5 cards produce misfortune. **No exceptions, no randomised "bad card."**
- The 5 cards must still feel like a real choice: each has a distinct name, illustration, and flavour line. **Card identity changes the flavour of the text, never the verdict.** This is the whole joke — the user thinks they chose, and the universe agrees with them anyway.
- A "fortune meter" is shown on reveal: HEAVEN rolls 97–100%, HELL rolls 0–3%. Never anything in between.

### Sentence generation — zero cost

No API calls, no backend, no cost. Generation is a **client-side slot-filling composer** over curated Thai phrase banks. This gives thousands of distinct outputs from a few hundred stored lines.

A reading is composed as:

```
[OPENER] + [ECHO of the user's text] + [TIMING/ESCALATION] + [EXTRA] + [CLOSER]
```

Each slot draws from a bank filtered by `mode` and (in HEAVEN) `category`. With 8 openers × 6 echo frames × 10 timings × 12 extras × 6 closers you already have >34,000 combinations per category before card flavour is layered in.

**Why verbatim echo works in Thai:** Thai has no verb conjugation, no noun inflection, and no subject-verb agreement. A user's phrase can be dropped into a template slot unchanged and still read naturally — which is exactly what makes zero-cost generation viable here. English would need real grammar transformation; Thai does not.

**Light normalisation before echo** (regex rules, no NLP):
- Strip leading intent markers: `อยาก`, `อยากให้`, `ขอให้`, `ช่วยให้`, `อยากได้`
- Strip trailing particles: `ครับ`, `ค่ะ`, `นะ`, `น่ะ`, `ด้วย`, `หน่อย`, `เลย`
- Trim whitespace and trailing punctuation
- Cap length at ~120 chars; if longer, echo the first clause and append `...` (the ECHO frames should still read correctly)
- If the field is empty → fall back to a `generic` bank entry for that mode/category

**Subject token.** Because HEAVEN mode can be about the user *or* about a liked third party, every bank line uses `{{SUBJECT}}` rather than a hardcoded pronoun:
- `ตัวเอง` → `คุณ`
- `คนอื่น` → `เขา`

Same for HELL, which always resolves `{{SUBJECT}}` → `อีนั่น` / `เขา` (alternate for tonal variety).

**No-repeat.** Keep an in-memory set of the last N picks per slot so consecutive re-rolls don't repeat. Session-only; no persistence needed.

### Content policy for HELL mode

The register is **petty cosmic inconvenience, not malice**. Curses should be things that ruin a Tuesday, not a life.

- ✅ In scope: bad luck, minor humiliation, karmic comeuppance, technology betrayal, food disappointment, social awkwardness.
- ❌ Out of scope: death, injury, illness, violence, sexual content, or anything about a real identifiable person's body, family, or protected characteristics. The app never asks for the target's name and should not store one.

This is a content decision, not just a safety one — petty is funnier than cruel, and it's what makes a reading screenshot-and-send-able. If the user types something genuinely violent into the curse field, the composer should **not** echo it verbatim: detect a small denylist of terms and swap in a "จักรวาลปฏิเสธคำขอนี้ แต่ขอเสนอทางเลือกที่เจ็บกว่า" frame that pivots to a petty-misfortune bank line instead. Handle this as a joke beat, not a lecture.

## Proposed approach

**Stack assumption:** the host repo is Next.js App Router + TypeScript on Vercel. **Verify this before writing any code** — check for `app/` vs `pages/`, and check whether styling is Tailwind, CSS Modules, or plain CSS. Follow whatever is already there. If the repo turns out to be Pages Router, Astro, or something else, adapt the file layout below; nothing in the design depends on the framework.

**Everything is client-side.** The interactive component carries `'use client'`; the route itself can stay statically rendered. The composer is pure TypeScript with no runtime dependencies — it must not import anything server-only.

**Theme isolation is the main integration risk.** HELL mode is a near-black, fire-lit full-bleed theme, and the host site has its own design system. The mode themes must not leak out of this route:
- Scope every theme variable to a wrapper element on this route (`data-mode="heaven" | "hell"` on the route's own container), never on `<html>` or `<body>`.
- Use CSS Modules or a route-scoped stylesheet, not global CSS.
- Check the site's global nav/header/footer against both themes. Either exclude them from this route via a route-group layout, or verify they remain legible on a black background. Decide this deliberately — an un-restyled light header floating above a hell background is the most likely visible bug.
- On unmount/navigation away, no theme state persists. Confirm by navigating to `/good-horoscope`, entering HELL mode, then going back to the landing page.

**Thai typography.** Load a Thai-supporting face through the framework's font pipeline (e.g. `next/font/google` with `subsets: ['thai']`) rather than a raw `@import` — IBM Plex Sans Thai or Noto Sans Thai Looped both work, and the looped variants suit the heaven mode. Verify Thai tone marks and vowel stacking render correctly at the display sizes used for the reading; badly-hinted Thai fonts clip diacritics at large sizes.

**Route metadata.** Set a Thai `title` and `description` for the route, plus an OG image, so the link previews properly when someone shares it — which, if the app works, they will.

**Browser target:** must work in Safari/WebKit — this is the primary audit environment. Avoid Chrome-only APIs. Test animations in Safari specifically; `backdrop-filter`, `mask-image`, and scroll-driven animations behave differently there. Respect `prefers-reduced-motion` for the fire and particle effects.

### Architecture

- **Single state machine** drives the whole app: `ASK_TARGET → ASK_AFFINITY? → MODE_REVEAL → ASK_WISH → PICK_CARD → RESULT`. One reducer, one session object. Because the flow is short and branching, a `useReducer` state machine is clearer than screen-level component state.
- **Session object:** `{ target, affinity, mode, category, freeText, chosenCardId, reading }`
- **Theme is one attribute:** `data-mode="heaven" | "hell"` on the root. All colour, type, and texture differences are CSS custom properties keyed off that attribute. Do not build two parallel component trees.
- **Composer is pure:** `compose(session, rngSeed) → Reading`. Same seed, same output. This makes the generator unit-testable and makes re-roll trivially just a new seed.
- **Banks are data, not code:** typed TS objects (or JSON) so lines can be added without touching logic. Every bank entry is `{ id, text, tags? }`.

### Visual design

- **HEAVEN:** soft gradient sky, cream/gold/pale blue, generous whitespace, rounded serif Thai display face for the reading, slow drifting light particles, gentle chime on reveal. Should feel like a spa.
- **HELL:** near-black background, ember orange/blood red, tight condensed Thai type, flickering glow, heat-shimmer on the card, screen-shake on flip. Should feel like a threat.
- The **mode transition** is the app's best moment — spend animation budget there. Heaven blooms open; hell burns in.
- Include a persistent, small, non-intrusive footer: *"แอปนี้สร้างมาเพื่อความบันเทิง โปรดใช้จักรยานในการรับชม"*

### Build sequence

0. Read the host repo: framework, routing style, styling convention, and where the landing-page directory gets its entry data. Write nothing until this is known.
1. Stub the route at `/good-horoscope` and wire the empty directory slot to it — get the plumbing working end to end before there's anything to see.
2. State machine + screens with unstyled placeholder text — get the flow correct.
3. Composer + banks + unit tests (this is the actual product; the UI is packaging).
4. HEAVEN theme, then HELL theme, then the transition. Verify theme isolation against the host site.
5. Card flip, meter, re-roll, copy-to-clipboard.
6. Metadata, OG image, Safari audit pass, Vercel preview deploy.

## Files / modules affected

Paths assume Next.js App Router — adjust to match the repo's actual convention.

**Modified (existing files):**
```
<wherever the landing-page directory data lives>   # fill the empty slot
```

**New:**
```
app/good-horoscope/page.tsx           # route entry, metadata, static
app/good-horoscope/layout.tsx         # optional — if host nav must be excluded
app/good-horoscope/App.tsx            # 'use client' root, owns the machine
app/good-horoscope/state/machine.ts   # reducer + session type
app/good-horoscope/engine/compose.ts  # slot-filling composer (pure)
app/good-horoscope/engine/normalize.ts# Thai text cleanup for echo
app/good-horoscope/engine/rng.ts      # seeded PRNG + no-repeat picker
app/good-horoscope/engine/guard.ts    # HELL denylist → pivot frame
app/good-horoscope/data/heaven.ts     # banks keyed by category
app/good-horoscope/data/hell.ts       # curse frames + petty-misfortune bank
app/good-horoscope/data/cards.ts      # 5 heaven cards, 5 hell cards
app/good-horoscope/screens/*.tsx      # AskTarget, AskAffinity, ModeReveal,
                                      # AskWish, PickCard, Result
app/good-horoscope/styles/*.module.css# base, heaven, hell — route-scoped
app/good-horoscope/opengraph-image.tsx# or a static OG image asset
app/good-horoscope/engine/__tests__/compose.test.ts
```

If the repo colocates by feature elsewhere (e.g. `src/features/`), follow that instead — the only hard requirement is that the styles are scoped and the engine is separable from the UI.

## Example content

Illustrative only — write more per bank. Target ~10 lines minimum per slot per mode/category.

**Cards**

| HEAVEN | HELL |
|---|---|
| ดาวประทานพร | ยมบาลจดชื่อ |
| ประตูสวรรค์ | ไฟไม่มีวันดับ |
| มือที่มองไม่เห็น | กรรมตามทัน (ด่วนพิเศษ) |
| แสงสุดท้ายก่อนรุ่ง | หม้อต้มใบที่ 8 |
| ลูกรักตัวจริง | บัญชีหนังหมา |

**HEAVEN — openers**
- `ไพ่ใบนี้... โห จักรวาลไม่ต้องคิดเลย`
- `เปิดมาปุ๊บ พลังงานสว่างจนต้องหรี่ตามอง`
- `ไพ่ใบนี้ปกติออกยากมาก แต่วันนี้มันรอ{{SUBJECT}}อยู่`

**HEAVEN — echo frames**
- `เรื่อง{{WISH}} — อนุมัติแล้ว ไม่ต้องยื่นเอกสารเพิ่ม`
- `{{WISH}}น่ะเหรอ ของมันต้องได้อยู่แล้ว {{SUBJECT}}ไม่ต้องทำอะไรเลยด้วยซ้ำ`
- `จักรวาลอ่าน "{{WISH}}" แล้วตอบกลับมาคำเดียวว่า "จัดให้"`

**HEAVEN — timing**
- `ภายใน 7 วันนี้` / `ก่อนสิ้นเดือน` / `เร็วกว่าที่คิดประมาณสองเท่า`

**HEAVEN — spoil add-on (the emotional payload)**
- `และที่ผ่านมา{{SUBJECT}}อดทนมามากพอแล้ว จักรวาลเห็นหมด ไม่ได้มองข้าม`
- `คนอื่นเขาต้องดิ้นรนกว่านี้เยอะ แต่{{SUBJECT}}แค่มีอยู่เฉยๆ ดวงก็วิ่งเข้ามาเอง`
- `ที่ผ่านมาไม่ใช่{{SUBJECT}}ไม่เก่งนะ แค่จังหวะมันยังไม่ถึง — ตอนนี้ถึงแล้ว`

**HELL — omen openers**
- `ไพ่ใบนี้พลิกมาแล้วมีกลิ่นไหม้`
- `เปิดมาปุ๊บ ยมบาลเงยหน้าจากงาน`

**HELL — echo frames**
- `เรื่อง{{CURSE}} — จัดให้ครับ แถมโปรโมชั่นซื้อหนึ่งแถมหนึ่ง`
- `{{CURSE}}น่ะเหรอ น้อยไป จักรวาลขอเพิ่มให้อีกเท่าตัว`

**HELL — petty misfortune extras**
- `หูฟังข้างซ้ายจะพังก่อนข้างขวาเสมอ`
- `สั่งหวานน้อยทุกครั้ง ได้หวานปกติทุกครั้ง`
- `ลิฟต์จะปิดใส่หน้าตอนวิ่งไปทันพอดี`
- `แบตจะเหลือ 1% ตอนกำลังจะสแกนจ่ายเงิน`
- `เจอไฟแดงทุกแยก รวมถึงแยกที่ไม่มีไฟแดง`

## Decision points for Kim

Resolved with an assumption so the build isn't blocked — override any of these.

1. **Third-party HEAVEN readings** are written about `เขา`, not `คุณ`, via `{{SUBJECT}}`. Alternative: keep it in second person and let it read as if the user is receiving news about them.
2. **HELL has no category step** — the free-text field carries it, mirroring the flow as described. If you want symmetry, a category picker (การงาน / ความรัก / สุขภาพการเงิน / ชีวิตทั่วไป) could be added.
3. **Free text is optional** — blank input falls through to a generic bank rather than blocking. This keeps the joke fast for users who just want to click.
4. **No target name is ever collected.** Adding one would make the HELL output feel like harassment rather than a bit.
5. **Session-only state.** No accounts, no history, no `localStorage`.
6. **Host chrome on this route.** Assumption: the site's nav/header is *hidden* on `/good-horoscope` so the mode theme can go full-bleed, with a single small "← kbstudio.space" link instead. Alternative: keep the nav and restyle it per mode. The first is less work and more immersive; the second is more consistent with the rest of the directory.
7. **Directory entry copy.** Assumption: entry titled `ดูดวงเข้าข้าง` with a one-line Thai description that does not reveal HELL mode — the reveal is the joke. Override if the other directory entries are described plainly.

## Acceptance criteria

- [ ] Every path through Q1/Q2 resolves to the correct mode; `คนอื่น + ชอบ/เฉยๆ` lands in HEAVEN.
- [ ] Unit test: 200 generated HEAVEN readings are all positive-polarity; 200 HELL readings are all negative-polarity. Zero leakage between banks.
- [ ] Unit test: 200 generations with fixed input produce <5% exact-duplicate full readings.
- [ ] Unit test: composer is deterministic given the same seed.
- [ ] Normalisation test: `อยากให้พี่เขาทักมาก่อนครับ` → echoes as `พี่เขาทักมาก่อน` inside a frame, reading naturally.
- [ ] Empty free-text produces a sensible generic reading, not a broken template with visible `{{WISH}}`.
- [ ] Grep the built bundle for `{{` — no unresolved tokens can reach the DOM.
- [ ] Denylist guard: a violent input is not echoed verbatim; the pivot frame fires.
- [ ] All 5 cards in each mode are individually selectable and produce visibly different flavour text, same verdict.
- [ ] Theme swap is complete — no heaven colours leak into hell state, verified by toggling `data-mode` in the inspector.
- [ ] Safari Web Inspector audit passes; no console errors; animations run in Safari, not just Chrome.
- [ ] `prefers-reduced-motion: reduce` disables shake, flicker, and particles while keeping the flow usable.
- [ ] Readable on a 375px-wide viewport; Thai text does not overflow its cards.
- [ ] Disclaimer footer is present on every screen.
- [ ] Route resolves at `/good-horoscope` on a Vercel preview deploy, not just locally.
- [ ] The previously empty directory slot on the landing page now links to it and matches the other entries' visual treatment.
- [ ] Theme isolation: enter HELL mode, navigate back to the landing page — no dark background, no leftover fonts, no altered global styles. Repeat with a hard refresh on the landing page.
- [ ] Thai tone marks and stacked vowels render correctly at the largest display size used for the reading.
- [ ] No API routes, serverless functions, or environment variables were added; build output is static.
- [ ] Sharing the URL produces a correct title/description/OG preview.

## Non-goals

- No backend, no database, no user accounts, no analytics.
- No LLM/API calls at runtime — the whole point is zero marginal cost.
- No real astrology: no birth dates, no zodiac calculation, no charts. The app is rigged and should not pretend otherwise.
- No English or other localisations.
- No image export / share-card rendering in v1 (copy-to-clipboard covers it).
