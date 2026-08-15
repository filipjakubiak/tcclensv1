# TCC Lens — Session Log

**Started:** 2026-08-14 · **Last worked:** 2026-08-15 (session closed)
**Working dir:** `C:\Users\filip\Desktop\neststudio\tcc-lens\`
**Branch:** `build/tcc-lens` · **HEAD:** `0271e8f` · working tree clean · suite **81/81 green**

---

# ▶ START HERE

**Read these two, in order:**
1. This file — orientation and what's next.
2. `.superpowers/sdd/2026-08-14-tcc-lens/progress.md` — **the ledger**, ~1180 lines. Every
   ruling, every measurement, every wrong turn and why it was wrong. It is the real record.
   *Gitignored — it lives on disk only. Do not run `git clean -fdx`.*

**Contract:** spec `docs/superpowers/specs/2026-08-14-tcc-lens-design.md`, plan
`docs/superpowers/plans/2026-08-14-tcc-lens.md`.

## Process as of 2026-08-15

**No subagents.** The user chose "I build it directly" — the controller is implementer and
verifier. Review agents were dropped earlier for cost. This means **nothing here has had an
independent look**; the final whole-branch review is the only one planned, and it matters.

## Commands

```
cd tools && npm test            # 82 tests, ~2 min (concurrency pinned to 3)
node tools/serve.mjs 4192       # or START.bat
```
- `http://localhost:4192/` · `?debug=1` act scrub slider · `?shot=1` all motion off, settled

---

# 1. Where the build is

| # | Task | State |
|---|---|---|
| 1–11 | Scaffold → glass LensMark | ✅ |
| 12 | SceneDirector + `?debug=1` scrub | ✅ |
| 13 | Act 1 Threshold | ✅ (rebuilt twice since) |
| 14 | Act 2 Head & Heart + GradientField | ✅ |
| 15 | Act 3 Prism + capability spectrum | ✅ |
| 16 | Act 4 Close — glass → solid logo | ✅ |
| 17 | Resilience — capability tiers, no-WebGL fallback | ⬜ |
| 18 | A11y, responsive, QA screenshots | ⬜ |
| 19 | Bento `#proof` | ✅ |
| 20 | Structural originality audit | ⬜ |

All four acts now run. **Tasks 17, 18 and 20 are the remaining plan work.**

---

# 2. The four things that cost the most time — don't repeat them

Every one was found by **measuring the rendered result**, and in three cases the first
confident explanation was wrong.

### 2.1 Transmission never sampled the backdrop
three.js renders **only opaque objects** into the transmission render target. Aisle plates were
`transparent: true`, so refraction never saw them. The pixel at the mark's centre was
byte-identical with the plates dim, blazing magenta, or deleted. **Any backdrop the glass
should refract must be opaque.**

### 2.2 I optimised a layer the DOM then multiplied by 0.14
The mark looked like a smudge on light sections. I ran a full material sweep — attenuation,
iridescence, envMapIntensity — measuring the WebGL buffer with `gl.readPixels`. The numbers
looked healthy while the screen showed a ghost. **The cause was CSS**: light sections painted
`--canvas` at 86% alpha over the canvas.
**`gl.readPixels` cannot see the DOM.** Contrast and visibility are now measured from a real
screenshot in `tools/test/composited-contrast.test.mjs`. Use that instrument.

### 2.3 One shared group doing two jobs, three times
An act assigning to a transform **replaces** whatever else that group carried:
`outer.scale.setScalar()` wiped the 2-unit normalisation (mark rendered 22 units tall, 305% of
frame); `head.position.x =` would have wiped the recentring offset; pivots above the fit scale
turned a 1.55-unit split into 0.14 world units *while the test passed*.
`LensMark.js` now gives every transform its own group. **Acts drive `group`, `headPivot`,
`heartPivot` — nothing else.**

### 2.4 An additive per-frame updater is not an oscillation
The mark was given an idle spin written as `rotation.y += Math.sin(elapsed)` inside a
per-frame updater. That **accumulates**: every frame adds another increment to the last, so it
span up continuously — 2.2 radians in 1.5 seconds. When the user reported it as too fast I
slowed the frequency, which only changed how fast it ran away.
**My test asserted only that rotation CHANGED over time, which a runaway satisfies perfectly.**
Reverted from both Act 1 and Act 4. If idle motion is wanted again, **assign an offset from a
stored base rotation**; never add to the live value. Assert a bounded range, not mere change.

### 2.5 Act ranges were fixed document fractions
The spec assigns acts to **sections**; the plan turned that into fixed fractions that did not
match. The hero is ~7% of the page, not 22%, so the dark act played under three light sections.
`director.alignToSections()` now derives boundaries from real section offsets. **Tests address
acts by name and local t via `setLocal(director, id, t)`** — never a hardcoded global progress.

---

# 3. Standing rules

- **Opaque backdrops only** for anything the glass refracts (§2.1).
- **Measure the composited page**, not the WebGL buffer (§2.2).
- **One group, one job** in `LensMark` (§2.3).
- **No hex outside `css/tokens.css`** — guard test enforces. WebGL JS may use hex *with a
  comment naming its token*.
- Body copy ≤ `1.125rem`. Tagline only ever appears whole.
- All motion gates on `prefers-reduced-motion` **and** `?shot=1`; page renders settled, never
  blank. Default CSS state is visible — a JS failure degrades to readable.
- Only **one** transmissive object in the scene (the LensMark); asserted.
- Exactly three `theme-dark` sections: `hero`, `film`, `loyalty-monitor`; asserted.
- **Colour blending in three.js is LINEAR** — an amount of 0.16 renders ~0.44 in sRGB.
- Act boundaries: each act exports its `END` state and the next blends from it. The continuity
  test has caught a real pop three times.

---

# 4. Next up — the user's list, in order

Done on 2026-08-15: Act 4, the element motion kit, varied per-section entrances, the hero
load-in, the bento regrid, `#how-it-works` as a stepped bento, gradient figures, the insight
hover glow, the CTA/footer repair.

**Still open:**

1. **`#careers`** — *"loyalty is built by people, ze zdjecie z prawej strony… trzeba to fajnie
   zanimowac."* The one section the user named that has no bespoke motion yet.
2. **Core gradient on flat `--accent` highlights** (`.focus-word`, `.btn--solid`, `.pill`).
   Needs `background-clip: text` and its own contrast check — `--accent` alone is ~2:1 on
   `--canvas`, which is why `--accent-strong` exists. The bento figures already do this
   correctly, with an `@supports` fallback; copy that pattern.
3. **More gradients** where they suit. Six assigned (`#thesis` core · `#how-it-works` insight ·
   `#insights` performance · `#global` sustainability · `#careers` creativity · `#contact`
   core). Each gradient used once — the brand book forbids combining two.
4. **Run `impeccable` and a taste skill** over the whole page. There is no `/taste` skill
   installed; candidates are `design-taste-frontend`, `gpt-taste`, `impeccable`.
5. **Tasks 17, 18, 20.**

## Motion contracts now in place — read before adding animation

- `[data-lift]` inside `[data-surface-group]` gets a staggered entrance ordered by distance
  from the group's top-left, plus a cursor-tracking sheen and tilt.
  **Entrance and hover compose through CSS custom properties inside ONE transform**
  (`--enter-y`, `--enter-s`, `--tilt-x`, `--tilt-y`). Do not animate `transform` directly on
  these — two owners of one property means whichever wrote last wins.
- Sections declare their copy's entrance direction with `data-enter`
  (`rise` · `left` · `right` · `lift` · `settle`). No two consecutive sections share one.
- `initHeroIntro()` owns the hero headline on load; it is excluded from the scroll-triggered
  focus-pull pass so one element never gets two timelines.
- Every act exports an `END` state and the next blends from it. The Act 1→2 continuity test has
  caught a real pop three times, most recently a 0.78-unit jump.

## Layout observations to act on later (asked for, recorded not fixed)

- `#how-it-works` uses **numbered section markers 01 / 02 / 03**. The design hook flags these
  as editorial scaffold. Worth replacing with a different cadence during the taste pass.
- **Em-dash density** across the ported copy trips the same hook. The copy is TCC's own and the
  spec says it is final — flagging only, not changing without a call.
- The mark is still **veiled on full-width sections** other than `#proof`. Sections with a
  sparse right-hand column let it through; dense ones do not. This is a layout matter and
  belongs with Task 20.
- `#capabilities` cards are gradient-painted but their **image slots are mostly empty** — only
  LoyaltyQuest has a photo. Four neutral rectangles.

## Known-good instruments in `tools/test/`

- `composited-contrast.test.mjs` — screenshots at nine scroll positions, samples the PNG. The
  only honest contrast measure. Slowest test (~30s) and worth it.
- `tinted-contrast.test.mjs` — token maths for the opaque tinted sections.
- `act1/2/3.test.mjs` — act behaviour, boundary continuity, backdrop swaps.
- Scratch probes used this session live in the session scratchpad, not the repo: mark-presence
  differ, glass absorption sweep, hero gradient sweep, real-scroll screenshotter.
