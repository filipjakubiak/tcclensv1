# TCC Lens — Session Log

**Started:** 2026-08-14 · **Last worked:** 2026-08-16
**Working dir:** `C:\Users\filip\Desktop\neststudio\tcc-lens\`
**Branch:** `build/tcc-lens` · suite **111/111 green**

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
cd tools && npm test            # 111 tests, ~5 min (concurrency pinned to 3)
node tools/serve.mjs 4192       # or START.bat
```
- `http://localhost:4192/` · `?debug=1` act scrub slider · `?shot=1` all motion off, settled

---

# 1. Where the build is

| # | Task | State |
|---|---|---|
| 1–11 | Scaffold → glass LensMark | ✅ |
| 12 | SceneDirector + `?debug=1` scrub | ✅ |
| 13 | Act 1 Threshold | ✅ (rebuilt three times — now a full-bleed curtain) |
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

- **Opaque backdrops only** for anything the glass refracts (§2.1). Both backdrops obey it:
  `GradientField` (painted canvas, Acts 2–4) and `FluidField` (shader, hero only).
  **Exactly one is visible at a time**, asserted in `act2.test.mjs`.
- The hero's morphing field is a **separate layer on purpose**. The painted field carries
  measured light-section contrast ceilings (`MAX_TINT`); animating it would put those back in
  play for a change that only concerns the dark hero.
- **Measure the composited page**, not the WebGL buffer (§2.2).
- **One group, one job** in `LensMark` (§2.3). `lens.pointer` sits ABOVE `lens.group` and
  carries the pointer lean; **acts must never write to it** — they assign to `lens.group` every
  frame and would erase anything put there. Asserted by driving every act across its range.
- **No hex outside `css/tokens.css`** — guard test enforces. WebGL JS may use hex *with a
  comment naming its token*.
- Body copy ≤ `1.125rem`. Tagline only ever appears whole.
- All motion gates on `prefers-reduced-motion` **and** `?shot=1`; page renders settled, never
  blank. Default CSS state is visible — a JS failure degrades to readable.
- Only **one** transmissive object in the scene (the LensMark); asserted.
- Exactly three `theme-dark` sections: `hero`, `film`, `loyalty-monitor`; asserted.
- **Colour blending in three.js is LINEAR** — an amount of 0.16 renders ~0.44 in sRGB.
- Act boundaries: each act exports its `END` state and the next blends from it. The continuity
  test has caught a real pop four times — and the fourth got through because the test sampled
  only the camera and the mark group. **A boundary test must sample everything an act hands
  over**, pivots included.
- **Anything off the view axis is seen at an angle.** The hero gate reads front-on because the
  leaves are parented to a group that yaws to face the camera, not because the camera moved.
- **`color-mix()` resolves to `color(srgb 0.51 0.31 0.57)` — 0-1 floats, not 0-255.** A stop
  parser that assumes `rgb()` reads them as near-black and passes every contrast check. And a
  custom property read with `getPropertyValue` comes back UNRESOLVED; paint it on a probe
  element to get real numbers.
- **Anything GSAP touches with `x`/`y`/`scale` can no longer take a transform from CSS.** GSAP
  writes an inline transform and inline outranks the stylesheet, so a `:hover` or `:active`
  transform on that element is dead code. Every primary button lost its press feedback this
  way. `.btn` composes `--mag-x`, `--mag-y`, `--intro-y` and `--press` in one transform.
- **Off-frame entrance states are a responsive bug.** `data-enter` parks copy at `x: ±34`,
  which extends scrollable overflow to the right — measured 404px of scroll width in a 390px
  viewport. `html { overflow-x: clip }` is what holds it (`clip`, not `hidden`: hidden makes
  the root a scroll container and fights Lenis).
- **Measure layout with `offsetHeight`, not `getBoundingClientRect()`**, wherever an entrance
  scales the element — the rect includes the transform, and a staggered entrance then reports
  identical boxes as different heights.
- **`gsap.fromTo` applies its START value at init, not when its ScrollTrigger fires.** Anything
  below the fold therefore sits in the "from" state until scrolled to. Fine for opacity; not
  fine for a property whose resting value is part of the brand.
- **Equal-specificity CSS is ordered by position, and `main.css` is long.** A later rule with
  the same weight silently wins. `html.motion-on .careers__img` lost to
  `html.motion-on [data-lift]` for a whole session. Only a rendered measurement caught it.
- **A pixel probe that can read past its buffer returns `undefined` → `NaN`**, and `NaN >= x`
  is false — which reports as a design failure that never happened. Bounds-check the sampler
  and assert the sample COUNT separately.

---

# 4. Next up — the user's list, in order

Done on 2026-08-15: Act 4, the element motion kit, varied per-section entrances, the hero
load-in, the bento regrid, `#how-it-works` as a stepped bento, gradient figures, the insight
hover glow, the CTA/footer repair.

Done on 2026-08-16, round one (eleven requests): hero gate front-facing · Act 2→3 boundary snap
fixed · core gradient on buttons and focal words · `#careers` motion · mobile menu illumination ·
equal-height steps and insight cards · fork-panel edge trace · hero CTA hover swap ·
monitor CTA spacing · `#global` untinted so the mark shows through.

Done on 2026-08-16, round three: the hero is a **full-bleed glass curtain** that parts left and
right as you start scrolling, with a lit `--accent` seam down each leaf's inner edge — the
thing that makes it read as doors rather than a haze. Behind it, `FluidField`: a shader
backdrop of drifting brand-colour bodies morphing into each other. Camera no longer dollies
through the gate plane; the director parks at the act's start so the curtain is shut on first
paint.

Done on 2026-08-16, round two (ten more): the gradient system settled on `--grad-core`
everywhere · all six stat figures gradient, one size except `1B+` · bento resolves per-cell on
scroll · `#how-it-works` level, equal width, interiors aligned · section-title motion (eyebrow
lead, per-section lean, wider stagger) · bigger `--eyebrow` · careers photo entrance un-deadened
· fluid pointer gradient on `#contact` and `#loyalty-monitor` · loyalty-gap meter draws ·
offices list draws in.

**Still open:**

1. **`.pill` is deliberately still flat.** All five live inside `.capability` cards that already
   paint their own gradient, and the brand book forbids combining two (asserted in
   `act3.test.mjs`). Needs a call from the user before it changes.
2. **More gradients** where they suit. `#global` gave up its sustainability tint to let the
   canvas through, so five remain assigned (`#thesis` core · `#how-it-works` insight ·
   `#insights` performance · `#careers` creativity · `#contact` core).
3. **Run `impeccable` and a taste skill** over the whole page. There is no `/taste` skill
   installed; candidates are `design-taste-frontend`, `gpt-taste`, `impeccable`.
4. **Tasks 17, 18, 20.**

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

## Gradient rules as of 2026-08-16 — READ BEFORE TOUCHING ANY GRADIENT

- **`--grad-core` everywhere, on every surface.** The rule the user stated twice: gradient
  paint must match the nav CONTACT button exactly — purple to light grey. `.btn--solid`,
  `.focus-word` (light AND dark), `.bento__figure`, `.pullquote::before`, the careers value
  rules, the menu wash, the fork edge trace, the fluid surfaces.
- **KNOWN, ACCEPTED, DO NOT "FIX": on light sections that gradient measures 2.54:1 and
  1.85:1 as text against `--canvas`**, under the 3:1 large-text floor. It was raised with
  numbers and confirmed. `gradient-text.test.mjs` PINS those two figures rather than
  asserting a floor — if they move, someone changed the gradient or the canvas.
- `--grad-core-strong` / `--support-strong` exist, are measured (5.87:1 and 8.55:1) and are
  **deliberately unused**. They are the contrast-safe alternative if that call is revisited.
  Do not delete them and do not silently reintroduce them.
- **`background-size` on gradient text must be `100% 100%`.** Anything larger pushes part of
  the ramp outside the glyphs and the word reads as flat purple. Asserted. Note that
  `.theme-dark .focus-word` overrides `background-image` but NOT `background-size`, so a
  size set on the base rule leaks onto every surface.
- **Gradient text is headline-scale only.** Micro labels stay solid.
- Every gradient-clipped rule sets a solid fallback colour FIRST and overrides it inside
  `@supports (background-clip: text)`, so an unsupported browser gets a coloured word rather
  than an invisible one.

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
  only honest contrast measure. Slowest test (~37s) and worth it.
- `tinted-contrast.test.mjs` — token maths for the opaque tinted sections.
- `gradient-text.test.mjs` — both stops of every gradient used as text, against both surfaces.
  Handles `rgb()`, hex and `color(srgb …)`; the last one is where mixed tokens land.
- `act1/2/3.test.mjs` — act behaviour, boundary continuity, backdrop swaps.
- `equal-height.test.mjs` — row-mates measure the same height at five widths, and the
  `#how-it-works` stagger survives it.
- `careers.test.mjs` — the photo drift is bounded so it never exposes its frame.
- `menu.test.mjs` — the overlay menu on a 420px viewport: illumination, scroll-spy, contrast.
- Scratch probes used this session live in the session scratchpad, not the repo: mark-presence
  differ, glass absorption sweep, hero gradient sweep, real-scroll screenshotter.
