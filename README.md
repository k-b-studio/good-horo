# ดูดวงเข้าข้าง (good-horo)

A joke Thai horoscope app, rigged from the first question. If the reading is about
you — or someone you like — every card is a blessing. If it's about someone you
dislike, every card is a petty curse. Pick any of five cards; the universe agrees
with you regardless.

The premise: real horoscope sites make people feel bad, so this one is structurally
incapable of doing that.

Served at **kbstudio.space/good-horoscope** via a Vercel rewrite from the
`kbstudio-pages` project, mirroring how `creditgpax` is mounted.

Design docs: `biased-horoscope-app.md` (v1) and `biased-horoscope-app-v2.md`
(v2 — adds the LLM, and records the measurements behind every decision here).

## Flow

```
ASK_TARGET → ASK_AFFINITY? → MODE_REVEAL → ASK_WISH → PICK_CARD → FLIPPING → RESULT
```

- `ตัวเอง` **or** `คนอื่น + ชอบ/เฉยๆ` → **HEAVEN** (โหมดลูกรักพระเจ้า)
- `คนอื่น + ไม่ชอบหน้า` → **HELL** (โหมดอีเวรนั่น มึงเจอกู)

One state machine (`src/lib/state/machine.svelte.ts`) owns the whole thing. The LLM
adds no states — its request is fired during steps the user was already spending
time on.

## How a reading is built

```
[OPENER] + [ECHO of your words] + [TIMING] + [EXTRA] + [CLOSER]
```

Four slots come from curated Thai phrase banks locked to the mode, which is what
guarantees polarity. Only `[EXTRA]` may come from the LLM, and only if it passes the
output gate — otherwise the bank line ships silently, indistinguishable from success.

The verdict, the mode, and the fortune meter (97–100% heaven / 0–3% hell) are all
decided **before** any network call. The model phrases; it never judges.

186 curated lines yield roughly 144,000 combinations per heaven category and
317,000 in hell, before card flavour is layered in.

**Why verbatim echo works:** Thai has no verb conjugation, noun inflection, or
subject–verb agreement, so a user's phrase drops into a template slot unchanged and
still reads naturally. `normalize.ts` only has to strip the intent framing
(`อยากให้…ครับ`) so the frame's wording doesn't collide with theirs.

## Latency strategy

The upstream ThaiLLM playground is free and shared: **~1–3s warm, 30–60s cold**, with
intermittent 502s. A low-traffic app is cold on almost every visit, so the cold case
is the *typical* case, not the rare one.

```
route mount ──► warm-up ping        (fixed dummy text, response discarded)
Q1 ─ Q2 ─ reveal ─ Q3               15–30s of interaction; the model loads here
wish submit ──► real request        card-agnostic, so it can start early
card pick → flip 1.2s ──► DEADLINE  use the line if it arrived, else the bank
```

The deadline is a **display** decision, not a network one — a late response is left
running, because it will be ready for the re-roll. Nothing ever blocks the reading.

## Content policy

HELL is **petty cosmic inconvenience, not malice** — curses ruin a Tuesday, not a
life. `guard.ts` blocks death, injury, illness, violence, sexual content, family,
and (added after a live model produced exactly this) **religious and royal
references**. Violent input is never echoed back; the reading pivots to a joke frame
and continues. The same denylist is applied to LLM output, because a model will
produce this material unprompted.

No target name is ever collected, and nothing is persisted.

## Structure

```
src/lib/engine/     pure TypeScript, no framework imports
  compose.ts        the slot-filling composer (pure, deterministic)
  normalize.ts      Thai cleanup for the echo slot
  rng.ts            seeded PRNG + no-repeat picker
  guard.ts          severe-harm denylist, shared by input and output
  gate.ts           LLM output validation — the critical module
  oracle.ts         client fetch: warm-up, deadline, abort
  prompt.ts         server-side prompt builder (never imported client-side)
src/lib/data/       heaven.ts, hell.ts, cards.ts — banks are data, not code
src/lib/state/      machine.svelte.ts
src/routes/api/oracle/+server.ts    the only server-side code
```

## Commands

```sh
npm run dev              # dev server
npm test                 # 46 unit tests (composer, normaliser, guard, gate, share)
npm run check            # svelte-check
npm run build            # production build
./tools/regenerate-og.sh # rebuild static/og.jpg (macOS only — uses CoreText)
```

Tests cover polarity across 200 readings per mode with zero bank leakage,
determinism under a fixed seed, <5% duplicate rate, and the gate against
**real captured API failures** — the unfenced English reasoning preamble, `<think>`
leakage, truncation, emoji, refusals. Synthetic fixtures would not have caught the
preamble, which is the failure a `<think>` stripper misses entirely.

## Environment

`THAILLM_API_KEY` is server-only and lives in `.env.local` (gitignored) plus Vercel
project settings. **With no key the app runs in composer mode and is fully
functional** — the LLM is an enhancement, never a dependency.

See `.env.example` for `ORACLE_MODE` (`auto` | `composer` | `llm-only`) and
`ORACLE_MODEL`.

## Deploying

Two repos, in this order:

1. **This repo** — create the Vercel project from GitHub, set `THAILLM_API_KEY` in
   project env vars, and confirm the production domain is `good-horo.vercel.app`.
2. **`kbstudio-pages`** — its `vercel.json` rewrite points at that exact hostname,
   and `src/lib/data/projects.ts` links the directory card to `/good-horoscope`.
   Push after step 1, or the rewrite targets nothing.

Deploys happen by pushing to GitHub. Do not use the `vercel` CLI.

## Known gaps

- **No Safari audit.** WebKit is the primary audit target and the flip plus
  mode-transition animations have not been checked there.
- **Not visually verified** at 375px, and Thai tone-mark rendering at the largest
  display size is unconfirmed by eye.
- **LLM output quality is poor.** Measured gate pass rate on live calls is ~5/8, and
  much of what passes is incoherent Thai — the gate filters format, not coherence.
  The hand-written banks are better comedy than an 8B model. `ORACLE_MODE=composer`
  disables the LLM path entirely if you'd rather ship without it.
- Cloudflare 403s unknown user-agents, so the proxy sets an explicit `User-Agent`.
  Node's default `node` UA gets blocked — don't remove that header.
