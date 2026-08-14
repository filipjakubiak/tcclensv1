# TCC Lens — Session Log

**Started:** 2026-08-14 · **Paused:** 2026-08-14 end of day
**Working dir:** `C:\Users\filip\Desktop\neststudio\tcc-lens\`
**Branch:** `build/tcc-lens` · **HEAD:** `6554bd4` · working tree clean · suite **53/53 green**

---

# ▶ START HERE TOMORROW

**Read these two files first, in this order:**
1. This file (orientation + what's next).
2. `.superpowers/sdd/2026-08-14-tcc-lens/progress.md` — **the ledger.** Every ruling I made,
   every deferred minor, every plan defect found. It is the real record. *It is gitignored —
   it lives on disk but is not in git. Do not run `git clean -fdx`.*

**Then read the contract:**
- Spec: `docs/superpowers/specs/2026-08-14-tcc-lens-design.md`
- Plan: `docs/superpowers/plans/2026-08-14-tcc-lens.md` (18 tasks; 19 and 20 added mid-run)

**Resume with:** `superpowers:subagent-driven-development`, at **Task 11 verification**.

## Immediate next action

**Task 11 (glass LensMark) is committed but UNVERIFIED, with one known defect.**

The mark renders correctly — two separate meshes (head circle + heart), `dispersion: 4.0`,
`transmission: 1.0`, geometry centred, tests green. **But it reads as matte dark grey plastic,
not optical glass.** No visible refraction, no colour fringing. Screenshot evidence was taken
at 1440×900 against the dark hero.

### My diagnosis (untested — verify before acting)

Probable causes, most likely first:

1. **There is nothing behind it to refract.** `transmission` refracts the *backdrop*. The
   scene background is flat `--chamber` `#08070A`, so the glass refracts near-black into
   near-black and shows nothing. Task 13's aisle photo-planes will give it real content to
   bend — the hero may simply be waiting for them. **Test this first**: temporarily put any
   textured plane behind the mark and see if the glass comes alive.
2. **No punctual lights in the scene.** Only the PMREM environment lights it. A faint purple
   rim on the heart's upper edge suggests the env map *is* applied but is too weak to drive
   visible dispersion.
3. **Environment intensity / tone mapping.** Renderer is `ACESFilmicToneMapping` at exposure
   1.05; the env gradient may need more range, or `scene.environmentIntensity` raising.
4. Least likely: the bevel. Check the implementer's report for the value it settled on and
   whether the heart cusp misbehaved.

**Do not accept "the tests pass" as resolution.** The tests assert material *properties*, not
that the glass *looks* like glass. This must be judged by rendering and looking.

---

## 1. The brief

Build a brand-new TCC Global site. Reuse copy from `../tcc-site/index.html`. Use
`../design-systems/HOMEDESIGN.md` for structure/rhythm. Colours per
`../design-systems/TCC Brand Guidelines.PDF` — **ignore that PDF's image colour grading, it is
outdated.** Hero: Three.js, grocery doors open to reveal the TCC head-and-heart in translucent
refracting glass. Imagery scraped from tccglobal.com, stills from video. Must be inspiring,
bold, original — "amazing animations… really blows the viewer's mind."

## 2. The spine (one paragraph — read this and you understand the site)

**TCC is a lens.** The brand book says so: *"vision, clarity and focus… captured through our
new evolved Head and Heart brand-mark."* The copy says *"loyalty lives in the head and the
heart."* So the page is one continuous optical event — **enter → focus → separate → split into
spectrum → resolve** — carried by a single persistent WebGL canvas in four acts. The motion
signature is the **focus pull**: text arrives out of focus (`blur(14px)`) and resolves sharp,
because the brand is a lens. Act 3 is the load-bearing idea: the brand's five secondary
gradients *are* a spectrum, and a prism splits light into a spectrum, so the capabilities
section literally becomes that spectrum.

## 3. Status — 11 of 20 tasks

| # | Task | State |
|---|---|---|
| 1 | Scaffold, server, Playwright harness | ✅ reviewed |
| 2 | Vendor libs — **dispersion hard gate PASSED** (three r185) | ✅ reviewed |
| 3 | Neue Plak WOFF2 400/600/700 | ✅ reviewed |
| 4 | Brand design tokens | ✅ reviewed |
| 5 | Asset pipeline — 101 images, 272 derivatives, 11 stills | ✅ reviewed |
| 6 | Page shell — layout, grain, nav, burger, overlay menu | ✅ reviewed |
| 7 | Thirteen sections, real copy, real photography | ✅ reviewed |
| 8 | Motion kit — focus pull, masked lines, gate | ✅ reviewed |
| 9 | Interaction kit — cursor, magnetic, counters | ✅ reviewed |
| 10 | WebGL stage — DPR cap, visibility rAF, dispose hook | ✅ reviewed |
| 11 | Procedural env + glass LensMark | ⚠️ **committed, unverified, known defect** |
| 12 | SceneDirector + `?debug=1` scrub UI | ⬜ |
| 13 | Act 1 — Threshold (sliding doors, aisle, dolly) | ⬜ |
| 14 | Act 2 — Head & Heart split | ⬜ |
| 15 | Act 3 — Prism + capability spectrum | ⬜ |
| 16 | Act 4 — Close (glass → solid logo) | ⬜ |
| 17 | Resilience — capability tiers, no-WebGL fallback | ⬜ |
| 18 | A11y, responsive, QA screenshots | ⬜ |
| 19 | **Rebuild `#proof` as bento mosaic** (user request) | ⬜ do last |
| 20 | **Structural originality audit + rework** (user request) | ⬜ after acts |

**Tasks 19 and 20 are user requests added mid-run — full specs in the ledger.** 20 matters:
the section layouts currently inherit the old site's shapes (my omission — I told Task 7 to
keep the copy verbatim and said nothing about composition).

## 4. Process notes for the new session

- **Review agents were dropped at the user's request** (token cost) after Task 10. From Task 11
  on, the controller verifies personally: read the diff, render the page, probe computed
  styles. **One final whole-branch review before handover is retained.**
- **Every visual defect in this build was found by looking, never by a test** — the invisible
  wordmark, the black-on-black burger, the force-wrapped hero, the plastic-looking glass.
  Render and inspect at every visual milestone.
- **Five separate false-PASS traps have surfaced.** A Node `--test-name-pattern` matching zero
  tests exits 0 and reports success. Run unfiltered or verify the executed count.
- **Standing instruction to implementers:** test files are theirs to fix when a brief is wrong;
  never bend production code to satisfy a broken test.
- Three implementers correctly rejected my suggested fixes after testing them. All three were
  right. Encourage that.

## 5. Useful commands

```
cd tools && npm test              # full suite, run unfiltered
node tools/serve.mjs 4192         # or START.bat
```
- `http://localhost:4192/` — the site
- `?debug=1` — act scrub slider (arrives in Task 12)
- `?shot=1` — all motion off, page settled (screenshot mode)

## 6. Key constraints (full list in the spec)

- No bundler, no CDN. Everything vendored.
- **No hex outside `css/tokens.css`** — guard test enforces. WebGL JS may use hex *with a
  comment naming its token*.
- Body copy ≤ `1.125rem`. `--accent` is never body text (use `--accent-strong` on light).
- Tagline `Inspiring loyalty. Creating value.` only ever appears whole.
- All motion gates on `prefers-reduced-motion` **and** `?shot=1`; page renders settled, never
  blank. Default CSS state is visible — a JS failure degrades to readable.
- Only **one** transmissive object in the scene (the LensMark). Doors use reflective glass.
- Exactly three `theme-dark` sections: `hero`, `film`, `loyalty-monitor`.
