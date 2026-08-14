# TCC Lens — Session Log

**Started:** 2026-08-14
**Working dir:** `C:\Users\filip\Desktop\neststudio\tcc-lens\`
**Status:** DESIGN APPROVED 2026-08-14. Spec written. Writing implementation plan. Nothing built yet.

**Read this first:** the full approved design lives in
`docs/superpowers/specs/2026-08-14-tcc-lens-design.md`. This file is the running
log; that file is the contract.

> Purpose of this file: if the session dies or credits run out, a fresh Claude
> session should be able to read this file alone and pick up exactly where we
> left off. Keep it updated at every milestone.

---

## 1. The brief (verbatim intent)

Build a **brand new** TCC Global website. Not an edit of any previous attempt.

- Reuse **copy/text** from `../tcc-site/index.html` (13 sections, ~2,500 words, already good).
- Use **`../design-systems/HOMEDESIGN.md`** as the system for interactions, scroll
  animations, and section rhythm.
- Reference: https://styles.refero.design/style/1a519123-071a-449f-b5df-0def73ed7f35
- **Hero:** responsive, Three.js. Grocery-store doors open to reveal the TCC
  head-and-heart logo rendered in **translucent glass with refractions**.
- Imagery scraped from www.tccglobal.com + generate stills from videos where needed.
- Must be **inspiring, bold, original** — an attention-capturing landing page.
- Colors per **`../design-systems/TCC Brand Guidelines.PDF`**.
  **Do NOT follow the color grading of the images in the guidelines — outdated.**
- "Amazing animations, three.js and gsap or whatever really blows the viewer's mind."

---

## 2. Decisions LOCKED (user answered 2026-08-14)

| # | Decision | Choice |
|---|---|---|
| 1 | Canvas strategy | **Dark hero → light body.** Hero is a dark cinematic chamber; page flips to HOMEDESIGN's light editorial canvas after the doors open. Dark returns only for the 2 interludes (brand film, Loyalty Monitor). |
| 2 | Doors | **Full 3D geometry.** Real Three.js meshes, hinged, aisle depth behind them, camera dolly through. Not a video plate. |
| 3 | Display typeface | **Neue Plak only.** Brand mandate beats HOMEDESIGN's PP Mondwest serif. Borrow HOMEDESIGN's editorial *scale* + tracking discipline (155–295px, -0.04em); single-family hierarchy by weight + scale. |
| 4 | Scroll ambition | **Full WebGL thread.** The glass mark persists as a canvas layer across the whole page, morphing and re-lighting per section (lens → heart → data prism). Not just a hero-only 3D moment. |

| 5 | WebGL architecture | **A · Single stage, all acts resident.** One canvas, one scene, one raf. `SceneDirector` interpolates camera/light/geometry across one normalized page-progress value. Acts declare keyframes; the director tweens. Fallback to hero-only on low-power / reduced-motion / `?shot=1`. |
| 6 | Glass fidelity | **Upgrade Three.js** and use built-in `MeshPhysicalMaterial.dispersion` (r160 does not have it). Verify the property exists immediately after vendoring. |
| 7 | Doors | **Sliding**, not hinged — real grocery stores use automatic sliding doors. Refinement accepted at design presentation. |
| 8 | Env map | **Procedural**, generated from TCC Purple → Space Grey via PMREM. No HDR file. The glass refracts brand colour by construction. |

### Still open (non-blocking)
- Neue Plak **web** embedding licence — confirm before any public deploy.
- Lowercase `r` alternate glyph — check TTF coverage, enable if present.
- Not a git repo. Consider `git init` (previous TCC work went to GitHub).

---

## 3. Source material inventory (all verified present on disk)

### Copy
`../tcc-site/index.html` — 13 sections:
1. Hero · 2. Thesis · 3. Proof/stat wall · 4. Brand film (dark) · 5. Fork
(retailers/brands) · 6. How it works · 7. Capabilities bento · 8. Loyalty Monitor
(dark) · 9. Clients · 10. Global · 11. Insights · 12. Careers · 13. Contact+footer

Tagline: **"Inspiring loyalty. Creating value."** — brand book requires it always
appear as the whole phrase. Never use half in isolation.

### Images — 121 files in `../tcc-site/assets/img/`
- `clients/` — 17 retailer logos (Albertsons, Carrefour, Coles, Lidl, REWE, Penny, Delhaize, Esselunga, Continente, Coop, IGA, Intermarché, Konzum, New World, ParknShop, Supervalu, Conrad)
- `partners/` — 11 brand partners (Netflix, WWF, MasterChef, Kappa, Peanuts, The Smurfs, Chefclub, Fissler, Schott Zwiesel, Hey Clay, Bench)
- `photos/` + `photos/optimized/` — hero photos w/ pre-built avif/webp at multiple widths
- `scraped/campaign/` — 21 case-study heroes (Konzum, Lidl, Coop, Intermarché, Alphamega, United, Sainsbury's, New World stamp card, CNY poster…)
- `scraped/global/` — team portraits, careers, about
- `scraped/lifestyle/` — **store interiors + shoppers — the key reference for the hero aisle**
- `scraped/product/` — 16 Loyalty Monitor / app / what-we-do UI screens
- `logo-icon.svg` — **the head-and-heart mark; source geometry for the 3D lens**
- `logo-text.svg`, `footer_logo.png`

### Video (for still extraction)
`../tcc-site/assets/media/brand-film.mp4`, `home-banner.mp4`
`../tcc-redesign/public/video/loyalty-monitor.mp4`

### Fonts
`../tcc-site/fonts/` — Neue-Plak-Regular.ttf, Neue-Plak-SemiBold.ttf, Neue-Plak-Bold.ttf

### Libraries (vendored, no CDN)
`../tcc-site/js/vendor/` — gsap.min.js, ScrollTrigger.min.js, lenis.min.js, three.module.js (**r160**)

### Tooling
`../tcc-site/tools/` — node + sharp already installed (image optimisation pipeline)

---

## 4. Brand facts extracted from TCC Brand Guidelines.PDF (2023)

**Primary palette**
| Name | Hex | Meaning |
|---|---|---|
| TCC Purple | `#D380EB` | The signature. Bold, ownable. |
| Space Grey | `#B1BDCE` | |
| TCC Core | TCC Purple → Space Grey gradient | |
| Black | `#000000` | |
| White | `#FCFCFC` | |

**Secondary palette — 5 gradient pairs (softer, for depth/backdrops)**
| Name | From | To |
|---|---|---|
| Performance / Impact | `#FFADBD` | `#CFD0F7` |
| Insight / Data | `#B7F4E6` | `#CFD0F7` |
| Creativity | `#FDFFCF` | `#F8C1F7` |
| Operational Excellence | `#FFC896` | `#D9CAF6` |
| Sustainability | `#B7F4E6` | `#E6F5A9` |

**Colour rules (from the PDF's do's/don'ts)**
- Do NOT use multiple colours from primary + secondary palette together.
- Use the primary palette for messaging that comes from TCC.
- Logo lock-up + tagline: black or white only — never multiple primary colours.
- Use gradients **sparingly**, to highlight information.
- **Never combine gradients.** Pair ONE gradient with black, white, or photography.

**Typography** — Neue Plak. Weights Light/Regular/SemiBold/Bold/Black.
**Semi Bold is the stated preference for all communications.** Arial is the
fallback when Neue Plak isn't embedded. Note the special glyph for lowercase `r`.

**Logo** — head and heart. Exclusion zone = the circle that represents the head
(1x), supporting lines at 0.5x. A **3D logo mark is officially sanctioned** for
large-scale communications, static or animated, "to reinforce the proposition of
clarity and focus."

**"TCC lens"** — the brand book's own framing: *"As leaders in value creation, TCC
provides vision, clarity and focus in an increasingly complex retail environment.
Captured through our new evolved Head and Heart brand-mark."*
→ **The glass/refraction hero is the brand's own stated intent, not a liberty.**
This is why the project is named `tcc-lens`.

**Graphic devices** — fully-rounded pill lozenges (keyline or filled) to break up
text and hero important detail. Primary-palette fill when the message is from TCC.

**Iconography** — built on a 12×12 grid around the circular form of the logo mark;
focal point is a keyline circle, coloured with the TCC Core gradient.

**Image treatment** — de-saturate imagery; use softer gradient tones as colour
washes in backgrounds/borders; reportage photography of people living in the
moment; **avoid faces where possible**. (User override: ignore the specific colour
grading shown on the PDF's example images — outdated.)

---

## 5. Technical findings

- **Three r160 has `transmission` but NOT `dispersion`.** True prismatic rainbow
  refraction needs either (a) a newer three release where
  `MeshPhysicalMaterial.dispersion` exists, or (b) a custom shader sampling the
  backdrop 3× at slightly different IORs per RGB channel. Decision pending.
- `transmission: 1` triggers a separate transmission render pass per transmissive
  object — the single biggest perf cost in the hero. Needs an explicit render-target
  resolution budget and a mobile downgrade path.
- HOMEDESIGN.md contains **no motion spec** — its "Animation & Interaction" section
  only describes button styling and explicitly says *no elaborate animations*. It is
  a **style capture, not a motion capture**. The refero reference video could not be
  watched (WebFetch returns text only). → We author the motion language ourselves;
  HOMEDESIGN supplies structure, type scale, spacing rhythm and component grammar.
- HOMEDESIGN's colour tokens (bone white `#fafffa` + neon green `#2bee4b`) are
  **discarded** — replaced by the TCC palette above. Only its *structural* system
  carries over.

---

## 6. Architecture options for the persistent WebGL thread — PENDING USER CHOICE

- **A · Single stage, all acts resident (recommended).** One fixed canvas behind the
  DOM, one renderer/scene. A `SceneDirector` holds "acts" (doors+lens → head/heart
  split → data prism → closing lens); ScrollTrigger drives one normalized page
  progress; the director crossfades camera + lighting + geometry between acts.
  True continuity, the mark never leaves screen. Cost: all geometry resident.
- **B · Single canvas, acts lazy mounted/disposed.** Lower peak memory, risk of
  pop-in, loses the morph continuity.
- **C · Multiple canvases, one per set-piece.** Simplest and most robust on mobile,
  but breaks the "thread" — the mark disappears and reappears.

Recommendation: **A**, degrading to a C-lite fallback (hero canvas only, static
posters elsewhere) on low-power devices, `prefers-reduced-motion`, and `?shot=1`.

---

## 7. Conventions carried over from previous TCC builds

- Static site, **no bundler**. Plain `index.html` + `css/` + `js/` with vendored ESM.
- `START.bat` to serve locally. Previous builds used ports 4190 (tcc-site) / 4191
  (tcc-lumen) — **this build will use 4192** to avoid collisions.
- `?shot=1` query hook disables all motion/animation for deterministic screenshots.
- All motion gated on `prefers-reduced-motion`.
- Placeholders (`.ph`) as intentional stand-ins — never a broken/empty box.

---

## 8. Progress log

| Date | Milestone |
|---|---|
| 2026-08-14 | Brainstorm started. Explored tcc-site, HOMEDESIGN.md, brand PDF. Extracted full brand palette + rules. 4 design forks answered and locked. |
| 2026-08-14 | Architecture forks answered (§2 rows 5–8). Full design presented and **approved** ("let's cook!"). Spec written to `docs/superpowers/specs/2026-08-14-tcc-lens-design.md`. Self-review passed. Nothing built yet. |

## 9. The spine (one paragraph, so a cold session gets it instantly)

**TCC is a lens.** The brand book says so: *"vision, clarity and focus… captured
through our new evolved Head and Heart brand-mark."* The copy says *"loyalty lives
in the head and the heart."* So the page is one continuous optical event —
**enter → focus → separate → split into spectrum → resolve** — carried by a single
persistent WebGL canvas in four acts. The motion signature is the **focus pull**:
text arrives out of focus (`blur(14px) scale(1.03)`) and resolves sharp, because
the brand is a lens. Act 3 is the load-bearing idea: the brand's five secondary
gradients *are* a spectrum, and a prism splits light into a spectrum, so the
capabilities section literally becomes that spectrum.

## 10. Next actions

1. ~~Pick architecture + Three.js path~~ — done.
2. ~~Present design, get approval~~ — done.
3. ~~Write spec~~ — done.
4. ~~Implementation plan~~ — done: `docs/superpowers/plans/2026-08-14-tcc-lens.md`, **18 tasks**, TDD throughout.
5. **→ Build**, in plan order. Awaiting user's choice of execution mode
   (subagent-driven vs inline).

### Hard gates baked into the plan — do not skip
- **Task 2 is a hard gate.** It asserts `MeshPhysicalMaterial.dispersion` exists in
  the vendored Three build. r160 does NOT have it. Nothing downstream works without
  this; do not proceed past Task 2 until its test is green.
- **Task 12 ships the SceneDirector + `?debug=1` scrub slider BEFORE any act
  content.** Four-act camera choreography is the highest-severity risk in the spec;
  the tuning instrument must exist before there is anything to tune.
- **Task 4's test forbids hex literals outside `css/tokens.css`.** This is what keeps
  the brand palette honest for the whole build.
- **Only `LensMark` uses `transmission`.** Act 1's doors use reflective envmap glass.
  Two transmissive objects blows the perf budget.

### Useful URLs during the build
- `http://localhost:4192/` — the site
- `http://localhost:4192/?debug=1` — scrub slider driving `director.setProgress`
- `http://localhost:4192/?shot=1` — all motion off, page settled (screenshot mode)
- `cd tools && npm test` — full Playwright suite
