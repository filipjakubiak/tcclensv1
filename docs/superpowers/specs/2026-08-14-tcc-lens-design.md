# TCC Lens — Design Specification

**Date:** 2026-08-14
**Project:** `C:\Users\filip\Desktop\neststudio\tcc-lens\`
**Status:** Approved by user 2026-08-14. Ready for implementation planning.

---

## 1. Purpose

Build a brand-new TCC Global landing page that is inspiring, bold and original —
a page that captures attention through a continuous WebGL narrative rather than
through decoration. It reuses proven copy, the real TCC brand palette, and the
structural discipline of the HOMEDESIGN editorial system.

### Success criteria

1. The hero reads as a genuine optical event — grocery doors part, camera moves
   through, and a head-and-heart mark in refracting optical glass is revealed.
2. The glass mark persists across the entire page as a single continuous WebGL
   thread, morphing through four acts without ever unmounting.
3. Every colour on the page traces to the TCC Brand Guidelines (2023). No rogue hex.
4. All display type is Neue Plak. No second display face.
5. The page is fully responsive and degrades gracefully: mobile, low-power devices,
   `prefers-reduced-motion` and `?shot=1` all produce a correct, non-broken page.
6. Body copy never exceeds 18px, preserving the editorial size-contrast rhythm.

### Non-goals

- Rewriting the copy. The existing copy is good and is reused near-verbatim.
- A multi-page site. This is a single landing page.
- A CMS, build step, or bundler. Static files only.
- Matching the colour grading of the images inside the brand PDF — the user
  explicitly flagged that grading as outdated.

---

## 2. The spine

The brand book supplies the central idea:

> *"As leaders in value creation, TCC provides vision, clarity and focus in an
> increasingly complex retail environment. Captured through our new evolved Head
> and Heart brand-mark."* — TCC Brand Guidelines, "TCC lens", p.08

**TCC is a lens. The mark is the thing you look through.** The copy supplies the
other half: *"Loyalty lives in the head and the heart."*

The whole page is therefore one continuous optical event:
**enter → focus → separate → split into spectrum → resolve.**

The brand book also explicitly sanctions a **3D logo mark** for large-scale
communications, "static or animation… to reinforce the proposition of clarity and
focus." The glass hero is the brand's own stated intent, not a liberty taken.

### The motion signature — the focus pull

Because the brand is a lens, text on this site never simply fades in. Every major
headline arrives **out of focus** — `filter: blur(14px)`, `scale(1.03)` — and
resolves to sharp over 900ms on `expo.out`. It is GPU-only, cheap, and belongs to
this site and no other. This is the single most important motion decision in the
spec; it is what makes the page feel authored rather than assembled.

---

## 3. Architecture

### 3.1 Overall shape

Static site. No bundler, no framework. Plain `index.html` + `css/` + `js/` with
vendored ESM modules. Served locally by `START.bat` on **port 4192** (4190 is
tcc-site, 4191 is tcc-lumen).

One `<canvas id="stage">` is `position: fixed`, full-viewport, `z-index: 0`, behind
all DOM. Page sections sit above it at `z-index: 1`, transparent where the canvas
should show through and opaque where it should not.

### 3.2 The WebGL thread — single stage, all acts resident

One renderer, one scene, one `requestAnimationFrame` loop, one dispose path.

```
main.js
  └ Stage.js            renderer · camera · clock · raf · resize · DPR cap
      └ SceneDirector.js
          progress 0→1 (driven by one page-level ScrollTrigger)
          ├ act1-threshold.js   0.00 – 0.22
          ├ act2-headheart.js   0.22 – 0.55
          ├ act3-prism.js       0.55 – 0.82
          └ act4-close.js       0.82 – 1.00
      └ LensMark.js       shared geometry + glass material, owned by the director
```

`SceneDirector` interpolates camera position, camera target, light rig and mark
transform continuously across act boundaries. Acts do not own the mark; they
declare **keyframes** for it, and the director tweens between them. This is what
guarantees the thread is continuous rather than a sequence of cuts.

Each act module exports a single object:

```js
export default {
  range: [0.22, 0.55],
  build(ctx),        // create act-local objects, add to scene, return handles
  update(t, ctx),    // t = 0→1 local progress; set transforms only
  enter(ctx), exit(ctx),   // optional, for one-shot state
}
```

Acts set transforms only. They never create or dispose during `update`. All
geometry is built once at boot and stays resident — this is the accepted cost of
choosing continuity.

**Why not lazy-mount:** disposing and rebuilding between acts reintroduces pop-in
and breaks the morph, which is the entire point of the chosen approach.

### 3.3 The glass material

`assets/img/logo-icon.svg` → Three `SVGLoader` → `ExtrudeGeometry` with a deep
extrusion and a generous bevel. **The bevel is what makes glass read as glass** —
it creates the caustic edges that sell refraction. Flat extrusion reads as plastic.

```js
new THREE.MeshPhysicalMaterial({
  transmission: 1.0,
  thickness:    2.4,
  ior:          1.52,
  dispersion:   4.0,     // prismatic edge-splitting
  roughness:    0.04,
  metalness:    0.0,
  iridescence:  0.25,
  clearcoat:    1.0,
})
```

**Three.js must be upgraded.** The currently vendored build is **r160, which has
no `dispersion` property**. Vendor a current stable release and verify at install
time that `MeshPhysicalMaterial` exposes `dispersion` before proceeding. The
existing `tcc-site/js/hero3d.js` is being rewritten from scratch, so r160 API
drift is not a migration concern.

### 3.4 Environment map — procedural, no HDR asset

The glass environment is generated at runtime as a gradient from TCC Purple
`#D380EB` to Space Grey `#B1BDCE` over the near-black chamber, rendered to a cube
render target via `PMREMGenerator`. Consequences:

- The glass refracts **brand colour by construction**, not by grading.
- Zero asset weight, no HDR file to ship or license.
- The environment can be re-tinted per act for free — act 3 swaps in the capability
  gradient of the section currently in view.

---

## 4. The four acts

| Act | Progress | DOM sections | Canvas behaviour |
|---|---|---|---|
| **1 · Threshold** | 0.00–0.22 | Hero | Night exterior. Automatic **sliding** glass doors part on the X axis; camera dollies from z≈8 to z≈1.2 through the threshold. Store-aisle photo planes provide z-parallax depth behind the doors. The head-and-heart mark hangs in the aisle as optical glass, refracting the aisle into prismatic streaks. |
| **2 · Head & Heart** | 0.22–0.55 | Thesis, Proof/stats | The mark **separates**. The circle (head) drifts left under cool Space Grey light; the heart drifts right under TCC Purple light — flanking the copy about the shopper's two simultaneous decisions. Both counter-rotate slowly through the stat wall. |
| **3 · Prism** | 0.55–0.82 | Fork, How it works, Capabilities bento, Loyalty Monitor | Halves recombine and rotate **edge-on into a prism slab**. Light through it splits into the five secondary brand gradients. The environment tint follows the capability section in view. |
| **4 · Close** | 0.82–1.00 | Clients, Global, Insights, Careers, Contact | The prism reassembles into the mark, recedes, and comes to rest small and **solid** above the footer — glass becomes the actual logo. Transmission animates to 0 and metalness/opacity resolve to a flat brand-black mark. |

**Doors are sliding, not hinged.** Real grocery stores use automatic sliding
doors; it is more specific to the subject and reads better against a camera dolly.

### Why act 3 is the load-bearing idea

The TCC brand book names five secondary gradients: *Performance/Impact,
Insight/Data, Creativity, Operational Excellence, Sustainability*. That is
literally a spectrum of five. A prism splits light into a spectrum. The
capabilities bento therefore **is** that spectrum, made legible. The mapping
already existed inside the brand system; the site is the first artefact to draw it.

---

## 5. Colour

HOMEDESIGN's palette is **discarded entirely** — bone white `#fafffa` and
Highlighter Green `#2bee4b` do not appear anywhere. Only HOMEDESIGN's *structure*
carries over. The TCC Brand Guidelines rule all colour.

### Tokens

| Role | Token | Value |
|---|---|---|
| Canvas (light body) | `--canvas` | `#FCFCFC` |
| Chamber (dark acts) | `--chamber` | `#08070A` |
| Ink | `--ink` | `#000000` |
| Ink secondary | `--ink-2` | `#4A4E57` |
| Ink tertiary | `--ink-3` | `#7C828C` |
| Accent | `--accent` | `#D380EB` (TCC Purple) |
| Support | `--support` | `#B1BDCE` (Space Grey) |
| Hairline | `--hairline` | `rgba(0,0,0,0.10)` |
| Hairline (dark) | `--hairline-inv` | `rgba(252,252,252,0.14)` |
| Signature gradient | `--grad-core` | `linear-gradient(105deg, #D380EB, #B1BDCE)` |

### Capability gradients — one per section, never combined

| Capability | From | To |
|---|---|---|
| Performance / Impact | `#FFADBD` | `#CFD0F7` |
| Insight / Data | `#B7F4E6` | `#CFD0F7` |
| Creativity | `#FDFFCF` | `#F8C1F7` |
| Operational Excellence | `#FFC896` | `#D9CAF6` |
| Sustainability | `#B7F4E6` | `#E6F5A9` |

Brand rules, enforced as layout constraints:
- **Never combine gradients.** One gradient per section, maximum.
- Always pair a gradient with black, white, or photography — never another gradient.
- Use gradients sparingly, to highlight information.
- Logo lock-up and tagline: black or white only. Never a primary colour.
- Do not mix primary and secondary palette colours in one composition.

### Three deliberate deviations from HOMEDESIGN

1. **Pills, not 5px rectangles.** HOMEDESIGN mandates sharp 5px CTAs; the brand
   book mandates fully-rounded lozenges as *the* graphic device and states they
   "must always be fully rounded." Brand wins. HOMEDESIGN's best detail survives —
   the accent-tinted shadow, here `0 8px 20px rgba(148,44,181,0.38)`. Purple-tinted,
   never grey.
2. **Paper feel via grain, not tint.** HOMEDESIGN gets its paper quality from a warm
   off-white; the brand mandates neutral `#FCFCFC`. The paper quality therefore comes
   from a subtle **PNG grain overlay**. It must be a PNG — an SVG filter destroys
   scroll performance.
3. **Purple is never body text.** `#D380EB` on `#FCFCFC` is roughly 2:1 contrast.
   The accent is restricted to fills, underlines, 3D lighting and single focal
   words. All reading text is `--ink` or the grey ramp. Non-negotiable.

HOMEDESIGN's **closing full-bleed accent band** is kept, in TCC Purple, carrying
the `tcc` mark, as the page's final signature before the footer.

---

## 6. Typography

Neue Plak only. Three self-hosted weights, converted TTF → WOFF2 with WOFF and TTF
fallback. Source files exist at `../tcc-site/fonts/`.

HOMEDESIGN contributes the **scale and tracking discipline**, not the faces.

| Role | Size | Weight | Tracking | Line height |
|---|---|---|---|---|
| Display | `clamp(3.5rem, 15vw, 18.4rem)` | Bold 700 | -0.04em | 0.88 |
| Heading-lg | `clamp(2.75rem, 9vw, 9.7rem)` | Bold 700 | -0.04em | 0.92 |
| Heading | `clamp(2rem, 5.5vw, 6rem)` | SemiBold 600 | -0.02em | 1.0 |
| Subheading | `clamp(1.75rem, 3.5vw, 3.75rem)` | SemiBold 600 | -0.02em | 1.05 |
| Lead | `clamp(1.125rem, 1.5vw, 1.375rem)` | Regular 400 | -0.01em | 1.5 |
| Body | `1.125rem` — **hard cap** | Regular 400 | -0.01em | 1.6 |
| Micro-label | `0.6875rem` uppercase | SemiBold 600 | +0.01em | 1.1 |

- **SemiBold 600 carries most communication**, per the brand book's stated preference.
- **Bold 700 is reserved for display** only.
- **Body never exceeds 18px.** The gap between 18px body and 155px+ display is what
  creates the editorial rhythm; violating it collapses the whole system.
- Micro-labels in uppercase SemiBold do all the work of UI chrome — no borders,
  no boxes, no decorative framing.
- The brand book notes a special alternate glyph for lowercase `r`. Check whether
  the TTFs carry it; if so, enable via `font-feature-settings`. Low priority.

---

## 7. Motion system

**HOMEDESIGN contains no motion specification.** Verified: its "Animation &
Interaction" section describes only button styling and explicitly states *no
elaborate animations*. It is a style capture, not a motion capture. The refero
reference video could not be watched (WebFetch returns text only). This motion
system is therefore authored, derived from the lens idea.

### Primitives

| Name | Behaviour |
|---|---|
| **Focus pull** | `blur(14px) scale(1.03)` → sharp. 900ms `expo.out`. The signature; every major headline. |
| **Masked line reveal** | Each line in `overflow:hidden`; inner span `translateY(110%) → 0`. Stagger 0.06. |
| **Chromatic hover** | Links and images split 2px on R/B channels on hover, tying DOM interaction back to the glass thread. |
| **Clip reveal** | Imagery revealed by animating `clip-path` inset, never by opacity alone. |
| **Count-up** | Stat wall figures, driven by ScrollTrigger enter. |
| **Magnetic pull** | `[data-magnetic]` on buttons; cursor-following translate, capped at 8px. |

### Tokens

- Easing: `--ease-out-strong: cubic-bezier(0.16, 1, 0.3, 1)` for reveals;
  `cubic-bezier(0.65, 0, 0.35, 1)` for scrubs.
- Durations: `--dur-press 160ms` · `--dur-ui 240ms` · `--dur-reveal 700ms` ·
  `--dur-hero 1200ms`.
- GSAP mirror: `expo.out`. Stagger range 0.04–0.09s.
- Engine: GSAP + ScrollTrigger + Lenis, all vendored. Act scrubbing uses `scrub: 1`.

### Forbidden

Bounce. Elastic. Spin-in entrances. `scale(0)` entrances. Decorative parallax.
Anything that fights reading.

### Gating

Every animation is gated on `prefers-reduced-motion: reduce` **and** on the
`?shot=1` query parameter, which disables all motion for deterministic screenshots.
Under either condition the page renders in its final, settled state — never blank,
never mid-transition.

---

## 8. Section rhythm

Thirteen sections, copy lifted near-verbatim from `../tcc-site/index.html`, mapped
onto the four acts. Dark surfaces appear only three times: the hero and the two
interludes the copy already treats as cinematic.

| # | Section | Surface | Act |
|---|---|---|---|
| 1 | Hero — *Inspiring loyalty. Creating value.* | **Dark** | 1 |
| 2 | Thesis — *Loyalty lives in the head and the heart* | Light | 2 |
| 3 | Proof / stat wall | Light | 2 |
| 4 | Brand film | **Dark** | 2→3 |
| 5 | Fork — retailers / brands | Light | 3 |
| 6 | How it works | Light | 3 |
| 7 | Capabilities bento — the five-gradient spectrum | Light | 3 |
| 8 | Loyalty Monitor | **Dark** | 3 |
| 9 | Clients | Light | 4 |
| 10 | Global | Light | 4 |
| 11 | Insights | Light | 4 |
| 12 | Careers | Light | 4 |
| 13 | Contact + footer, closing purple accent band | Light → accent | 4 |

The tagline **"Inspiring loyalty. Creating value."** must always appear as the
whole phrase. The brand book forbids using either half in isolation.

---

## 9. Components

| Component | Specification |
|---|---|
| **Button — solid** | Fully-rounded pill. `--accent` fill, `--ink` label, micro-label type. Shadow `0 8px 20px rgba(148,44,181,0.38)`. States: default, hover (magnetic + lift), focus (2px accent ring, 2px offset), active (`scale(.97)`), disabled (0.4 opacity). |
| **Button — ghost** | Transparent, 1px hairline border, pill. Used on dark surfaces. |
| **Text link** | No fill. 1px underline hugging the baseline, animating from left on hover. Never changes weight or colour. |
| **Pill lozenge** | The brand's graphic device. Keyline or filled, always fully rounded. Filled uses the primary palette when the message comes from TCC. |
| **Card** | `--canvas` surface, 1px hairline, 20px radius. Hover: 4px lift + soft shadow. No shadow at rest. |
| **Nav** | Slim. Transparent with light text over the dark hero; flips to blurred paper with ink text on scroll into the light body. Fullscreen overlay menu. |
| **Cursor** | Custom blend-difference dot that swells over interactive targets. Fine pointers only — disabled on touch. |
| **Placeholder** `.ph` | Intentional stand-in while functionality is built: tinted surface, hairline frame, centred mono label (e.g. `IMAGE · Shopper at checkout`). Video variant adds a play glyph. **Never a broken or empty box.** |
| **Icon** | 12×12 grid, built on the circular form of the mark, keyline circle as focal point, TCC Core gradient — per the brand book's iconography system. |

---

## 10. Assets

### Images
All 121 scraped images copied from `../tcc-site/assets/img/` and re-optimised to
AVIF + WebP at responsive widths via the existing `sharp` pipeline in `tools/`.

- `clients/` — 17 retailer logos
- `partners/` — 11 brand partners
- `scraped/campaign/` — 21 case-study heroes
- `scraped/global/` — team, careers, about
- `scraped/lifestyle/` — **store interiors; the aisle-depth source for act 1**
  (`deftera-store.jpg`, `newworld-store.jpg`, `home-hero-section.png`)
- `scraped/product/` — 16 Loyalty Monitor / app screens
- `logo-icon.svg` — **source geometry for the 3D lens mark**

### Video stills
`ffmpeg is not installed.` Stills are extracted with **Playwright**
(available at `../tcc-redesign/node_modules`) by loading each mp4 in a page,
seeking to timestamps, and screenshotting the video element. Sources:
`brand-film.mp4`, `home-banner.mp4`, `loyalty-monitor.mp4`.

### Image treatment
Per the brand book: de-saturate imagery; use the softer gradient tones as colour
washes in backgrounds and borders; prefer reportage photography of people living
in the moment; **avoid faces where possible.**

**User override:** do *not* reproduce the colour grading shown on the example
images inside the brand PDF — that grading is outdated.

### Generated
- `grain.png` — subtle paper-grain tile. PNG, not an SVG filter.
- Environment map — generated procedurally at runtime, no file.

---

## 11. Performance and resilience

| Concern | Mitigation |
|---|---|
| `transmission: 1` triggers a separate render pass per transmissive object — the single largest cost | Transmission render target at half resolution. Exactly one transmissive object in the scene at any time. |
| High-DPI cost | `renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))` |
| Background tabs | Pause the raf loop on `visibilitychange` |
| Low-power / mobile | Degrade to hero-only: doors still animate, but the mark uses a reflective non-transmissive material; acts 2–4 become static. Detected by device memory, hardware concurrency and a first-frame timing probe. |
| Reduced motion | All motion disabled; page renders settled. Canvas shows act 1's final framing as a still. |
| `?shot=1` | Same as reduced motion, for deterministic screenshots. |
| No WebGL | Canvas hidden; hero falls back to a dark section with a static poster still and the full headline. Page remains complete and legible. |
| Image weight | AVIF/WebP with `<picture>` and explicit `width`/`height` to prevent layout shift. |

---

## 12. Accessibility

- All reading text is `--ink` or the grey ramp. **The accent is never body text.**
- Focus rings: 2px `--accent` at 2px offset, visible on every interactive element.
- Fullscreen menu traps focus and closes on `Escape`.
- The canvas is `aria-hidden="true"` — it carries no information the copy does not.
- Headings form a correct, sequential outline; the reveal system never removes text
  from the accessibility tree.
- Every image carries meaningful `alt`; decorative images carry `alt=""`.
- `prefers-reduced-motion` is honoured throughout, including the Lenis smooth scroll,
  which is disabled rather than merely shortened.

---

## 13. File structure

```
tcc-lens/
  index.html
  START.bat                     serves on port 4192
  SESSION.md                    living session log
  MASTER.md                     design-system single source of truth
  docs/superpowers/specs/2026-08-14-tcc-lens-design.md
  css/
    tokens.css                  every brand token; no rogue hex anywhere else
    fonts.css                   @font-face, Neue Plak WOFF2
    main.css
  js/
    main.js                     boot · Lenis · reduced-motion + ?shot=1 gate
    stage/
      Stage.js                  renderer · camera · clock · raf · resize · DPR
      SceneDirector.js          act registry + keyframe interpolation
      LensMark.js               SVG → ExtrudeGeometry → glass material
      env.js                    procedural PMREM environment from brand colours
      acts/
        act1-threshold.js
        act2-headheart.js
        act3-prism.js
        act4-close.js
    motion/
      reveal.js                 focus pull + masked line reveals
      cursor.js
      nav.js
      counters.js
    vendor/
      three.module.js           UPGRADED — must expose MeshPhysicalMaterial.dispersion
      gsap.min.js  ScrollTrigger.min.js  lenis.min.js
  assets/
    img/                        optimised AVIF/WebP
    media/
    grain.png
  tools/
    stills.mjs                  Playwright video-frame extraction
    photos.mjs                  sharp image optimisation
    shot.mjs                    Playwright ?shot=1 QA screenshots
```

Each module has one purpose and can be understood without reading the others.
`SceneDirector` is the only module that knows about more than one act;
acts know nothing about each other.

---

## 14. Risks

| Risk | Severity | Response |
|---|---|---|
| Upgraded Three release changes an API the new code relies on | Medium | Verify `dispersion` exists immediately after vendoring, before writing act code. All hero code is new, so there is no migration surface. |
| Transmission + dispersion too slow on mid-range laptops | High | Half-res transmission target; single transmissive object; measured first-frame probe with automatic downgrade. Budget must be validated early, not at the end. |
| Four-act camera choreography is the hardest part of the build | High | Build the director and a debug scrub UI **before** any act content, so choreography can be tuned in isolation. |
| Extruded SVG heart geometry may have artifacts at the point/cusp | Medium | Inspect the extruded mesh early; simplify or hand-author the path if the bevel self-intersects at the heart's point. |
| Font licensing for web embedding of Neue Plak | Medium | Flag to the user. The TTFs are on disk and the brand book mandates the face, but web embedding is a distinct licence from desktop use. Not a blocker for local development. |

---

## 15. Open items

- **Neue Plak web licence** — confirm before any public deployment.
- **Lowercase `r` alternate glyph** — check TTF glyph coverage; enable if present.
- Not a git repository. The user may want `git init` here so the spec and build are
  version-controlled; previous TCC work was pushed to GitHub.
