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

**Task 11 (glass LensMark) is COMPLETE and self-verified by its implementer.** Read its
report: `.superpowers/sdd/2026-08-14-tcc-lens/task-11-report.md`.

Two independent looks agree on the substance, and differ on wording:
- **Implementer's verdict:** "glossy, dark-tinted glass — crisp clearcoat specular, clean
  violet Fresnel rim along every edge including the heart's cusp, not frosted/matte plastic."
- **My screenshot at 1440×900:** read closer to matte dark grey. My capture may have caught it
  before final camera/lighting tuning; the implementer verified the committed bytes match its
  final files. **Judge it yourself with fresh eyes before acting on either description.**

**Both agree on the one substantive point: genuine rainbow dispersion is currently inert.**
`dispersion: 4.0` is verified live on the material, but `scene.background` is the flat
`--chamber` `#08070A`, so the transmission path has nothing colourful behind the mark to
refract. Near-black refracts into near-black.

**This is architectural, not a defect.** Dispersion becomes visible when:
- **Task 13** puts the aisle photo-planes behind the mark (real content to bend), and
- **Task 15** turns it edge-on into a prism, where the light path through the glass is longest
  and the fringing is strongest.

So do not "fix" it in isolation — build Task 13 and re-judge. If it is still inert with a
textured backdrop behind it, *then* investigate: environment intensity, `scene.environmentIntensity`,
ACES tone mapping at exposure 1.05 compressing the range, or adding a punctual light.

**Do not accept "the tests pass" as resolution.** The tests assert material *properties*, not
that the glass *looks* like glass. That is judged by rendering and looking.

### One note to disregard in the Task 11 report

Its concern #2 reports "a second, concurrent process operating on this same repo/branch" that
committed its work and wrote a `SESSION.md` with a 20-task plan. **That was me, the
controller** — this is the normal architecture, not a rogue process. I committed its finished
working tree because the session was closing and the work was uncommitted; the implementer
confirmed the committed content is byte-identical to its final files. Nothing was lost or
altered. Its "wip / unverified" commit message is superseded by its own report.

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
| 11 | Procedural env + glass LensMark | ✅ complete, self-verified (no review agent) |
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
