# PRODUCT.md — TCC Lens

Strategic context for design work on this project. Written 2026-08-16, derived
from the authoritative sources already in the repo rather than from an
interview: `docs/superpowers/specs/2026-08-14-tcc-lens-design.md` (the
contract), the TCC Brand Guidelines 2023 it cites, and `SESSION.md`.

Answers who / what / why. Visual specifics (palette, type, components) live in
the spec's sections 5–9 and in `css/tokens.css`, which is the single source of
truth for colour.

---

## Register

**Brand.** Design IS the product here. This is a single marketing landing page
whose job is to make an impression; there is no app behind it, no dashboard, no
authenticated surface. Every design decision is judged on whether it makes the
page more persuasive and more distinctly TCC, not on task throughput.

Consequence for tooling: read `reference/brand.md`, not `reference/product.md`.

---

## What this is

A brand-new landing page for TCC Global, a company that designs shopper loyalty
campaigns for grocery retailers and consumer brands. Static files only — no
CMS, no build step, no bundler. One page, thirteen sections.

Its distinguishing feature is a **continuous WebGL narrative**: a head-and-heart
brand mark in refracting optical glass that persists across the whole page as a
single thread, morphing through four scroll-driven acts without ever
unmounting.

---

## Users & purpose

**Who.** Two audiences, deliberately addressed as equals in one page:

- **Retail decision-makers** — grocery chains weighing a loyalty programme.
  They arrive sceptical and numerate; they want evidence of uplift.
- **Brand marketers** — consumer brands looking for shelf presence that is not
  another impression. They want to know what the association buys them.

A third, quieter audience: **candidates**, served by `#careers`.

**Context of use.** Desktop, in a working day, probably one tab among many,
often as a first look after a referral or a search. Not a tool anyone returns
to daily — most visitors see this page once, which is why the motion budget is
spent on arrival rather than on repeated interactions.

**The job.** Convince a professional that TCC is more considered than its
competitors, and that loyalty is a measurable business lever rather than a
marketing softness. Then get them to start a conversation.

**Emotions to evoke.** Clarity, confidence, precision. Not warmth, not
playfulness, not urgency. The page should feel *authored* — as though a person
made every decision in it — which is the whole argument for the WebGL thread
existing at all.

---

## The spine

From the brand book: *"As leaders in value creation, TCC provides vision,
clarity and focus in an increasingly complex retail environment. Captured
through our new evolved Head and Heart brand-mark."*

**TCC is a lens. The mark is the thing you look through.** The copy supplies
the other half: *"Loyalty lives in the head and the heart."*

So the page is one continuous optical event:
**enter → focus → separate → split into spectrum → resolve.**

Everything visual must be checkable against that sentence. The glass hero is
the brand book's own stated intent — it explicitly sanctions a 3D logo mark for
large-scale communications, "static or animation… to reinforce the proposition
of clarity and focus" — not a liberty taken.

---

## Brand personality

**Precise · optical · unhurried.**

- **Precise** — every colour traces to the TCC Brand Guidelines 2023; a guard
  test fails the build on any hex outside `css/tokens.css`.
- **Optical** — the recurring device is focus, refraction and light. Text
  arrives out of focus and resolves; surfaces catch a highlight as the cursor
  passes; the hero is literally a lens.
- **Unhurried** — body copy is capped at 18px and the layout is generous.
  Confidence is expressed by leaving space, not by filling it.

---

## Anti-references

What this must NOT look like:

- **Generic SaaS marketing.** No hero-metric template, no three identical
  feature cards, no icon-heading-paragraph grid.
- **The colour grading inside the TCC brand PDF.** The user explicitly flagged
  that grading as outdated. The palette is reused; the photographic treatment
  is not.
- **A decorated page.** Motion here explains or reveals. Decorative parallax is
  forbidden by the spec by name.
- **Anything that fights reading.** The WebGL thread is behind the copy and
  must never win against it.

---

## Accessibility

Requirements, from spec §12 — these are commitments, not aspirations:

- The accent colour is **never body text**.
- Focus rings on every interactive element: 2px `--accent`, 2px offset.
- The fullscreen menu traps focus and closes on `Escape`.
- The canvas is `aria-hidden="true"` — it carries nothing the copy does not.
- Headings form a sequential outline; the reveal system never removes text from
  the accessibility tree.
- Every image carries meaningful `alt`; decorative images carry `alt=""`.
- `prefers-reduced-motion` is honoured throughout, **including disabling Lenis
  smooth scroll entirely** rather than merely shortening it.
- `?shot=1` disables all motion for deterministic screenshots. Under either
  gate the page renders in its final settled state — never blank, never
  mid-transition.

### Known, accepted deviations

Recorded so nobody "fixes" them by surprise, and so an audit can distinguish a
decision from an oversight:

1. **Gradient text** on focal words and stat figures. An absolute ban in the
   impeccable ruleset. Requested explicitly and repeatedly by the user, and
   confirmed against measured contrast: on light sections the brand gradient
   measures **2.54:1 and 1.85:1** against `--canvas`, below the 3:1 large-text
   floor. `--grad-core-strong` exists, is measured safe (5.87:1 / 8.55:1) and
   is deliberately unused. `gradient-text.test.mjs` pins the measured cost so
   a future change to the gradient or the canvas fails loudly.
2. **A custom cursor** that replaces the system pointer. Also banned by that
   ruleset. Specced in the original plan (Task 9) and reaffirmed by the user.
   Mounted only on a fine pointer with motion enabled, so touch and
   reduced-motion readers keep their own pointer.
3. **An eyebrow on every section.** Flagged as AI grammar above ~55% of
   sections; this page has one on all thirteen. Open — not yet decided.

---

## Strategic design principles

1. **Measure the composited page, not the layer.** Contrast and visibility are
   judged from a real screenshot. `gl.readPixels` cannot see the DOM, and the
   DOM once multiplied a carefully-tuned WebGL layer by 0.14.
2. **Default state is visible.** A JS failure, a hidden tab or a headless
   renderer must still produce a readable page. Motion enhances what is already
   there; it never gates content on a class that may never arrive.
3. **One idea, applied at every scale.** The lens is the page (hero), the
   section (focus-pull headlines), and the component (a surface catching a
   highlight under the cursor). New motion should extend that idea rather than
   introduce another.
4. **Bounds, not change.** Any assertion about motion states a range. A test
   that only checks a value moved once passed a runaway animation for a full
   session.
5. **Copy is final.** TCC's own words, reused near-verbatim. Design adapts to
   the copy, not the other way round.

---

## Non-goals

- Rewriting the copy.
- A multi-page site.
- A CMS, build step or bundler.
- Matching the brand PDF's photographic colour grading.
