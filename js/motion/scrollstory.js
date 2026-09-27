import { motionEnabled } from './reveal.js';

/**
 * Scroll stories — four places where the scroll itself carries meaning.
 *
 * Each one has a job (motion-design skill: "every animation needs a job"):
 *
 *   initThesisLights  understanding — the head and heart phrases underline
 *                     as the reader reaches them, head first, the same order
 *                     Act 2 hands its light from Space Grey to TCC Purple.
 *   initDeal          the three steps are dealt in from the left (below)
 *   initLoop          understanding — spend → reward → return is a loop, so
 *                     it is drawn as one, and the scroll walks a shopper
 *                     round it, lighting each step as they arrive.
 *   initUplift        understanding — "3–5%" is a lift above a baseline;
 *                     the line draws, rises through the activation window
 *                     and settles higher than it started.
 *
 * Timing follows the skill's decision tree:
 *   - Scrubbed pieces map scroll to progress LINEARLY (ease 'none' — it is
 *     a progress visualisation), with a short scrub lag for smoothing. The
 *     scroll is the clock; easing it would make the reader's own hand feel
 *     inconsistent.
 *   - One-shot pieces are illustrative, low-frequency marketing motion:
 *     ease-out (power4.out ≈ --ease-out-quart), 1.2–1.4s.
 *
 * All of them reverse cleanly on scroll-up (scrub) or play once (numbers),
 * and none assigns anything that accumulates.
 *
 * CSS states the finished picture by default; html.motion-on parks each at
 * its start. So when motion is off these functions simply return.
 */

const SCRUB = 0.6; // seconds of catch-up — smooths wheel steps, never lags a read

function gsapReady() {
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  return { gsap, ScrollTrigger };
}

export function initThesisLights() {
  if (!motionEnabled()) return;
  const { gsap } = gsapReady();
  for (const el of document.querySelectorAll('#thesis .hl')) {
    gsap.fromTo(el, { '--hl': 0 }, {
      '--hl': 1,
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 82%', end: 'top 52%', scrub: SCRUB },
    });
  }
}

export function initLoop() {
  if (!motionEnabled()) return;
  const loop = document.querySelector('.howworks__loop');
  const steps = [...document.querySelectorAll('.howworks__step')];
  if (!loop || steps.length !== 3) return;

  const { gsap } = gsapReady();
  const fwd = loop.querySelector('.loop__fwd');
  const ret = loop.querySelector('.loop__ret');
  const nodes = [...loop.querySelectorAll('.loop__node')];
  const dot = loop.querySelector('.loop__dot');

  // Where along the whole scrub each part happens. The forward run is
  // longer than the return because it carries three arrivals.
  const FWD_END = 0.6;
  const RET_END = 0.92;
  const ARRIVE = [0.02, FWD_END / 2, FWD_END]; // node i is reached at these

  // Dot position is sampled from the real paths in viewBox units, then
  // expressed as a percentage of the box — the SVG is stretched with
  // preserveAspectRatio="none", so a circle drawn inside it would squash.
  const VB_W = 1200, VB_H = 120;
  const fwdLen = fwd.getTotalLength();
  const retLen = ret.getTotalLength();
  const place = (path, len, f) => {
    const p = path.getPointAtLength(len * f);
    dot.style.left = `${(p.x / VB_W) * 100}%`;
    dot.style.top = `${(p.y / VB_H) * 100}%`;
  };

  const mm = gsap.matchMedia();

  // Desktop: the loop is drawn and walked.
  mm.add('(min-width: 861px)', () => {
    const state = { p: 0 };
    const render = () => {
      const p = state.p;
      const f = gsap.utils.clamp(0, 1, p / FWD_END);
      const r = gsap.utils.clamp(0, 1, (p - FWD_END) / (RET_END - FWD_END));
      fwd.style.setProperty('--draw', 1 - f);
      ret.style.setProperty('--draw', 1 - r);
      if (p <= FWD_END) place(fwd, fwdLen, f); else place(ret, retLen, r);
      // Dot fades in on departure and out once it is home again.
      dot.style.setProperty('--dot-o', p < 0.01 || p > 0.97 ? 0 : 1);

      ARRIVE.forEach((at, i) => {
        const on = p >= at;
        nodes[i].classList.toggle('is-on', on);
        steps[i].classList.toggle('is-lit', on);
      });
      // Back at the start: the first node rings wider — round two is bigger.
      nodes[0].classList.toggle('is-lap', p >= RET_END);
    };

    gsap.to(state, {
      p: 1,
      ease: 'none',
      onUpdate: render,
      scrollTrigger: {
        trigger: loop,
        start: 'top 78%',
        endTrigger: steps[0].parentElement,
        end: 'bottom 60%',
        scrub: SCRUB,
      },
    });
    render();

    return () => {
      steps.forEach((s) => s.classList.remove('is-lit'));
      nodes.forEach((n) => n.classList.remove('is-on', 'is-lap'));
    };
  });

  // Mobile: the loop is hidden and the steps stack, so each step simply
  // lights as it crosses the middle of the screen.
  mm.add('(max-width: 860px)', () => {
    const { ScrollTrigger } = window;
    const triggers = steps.map((s) =>
      ScrollTrigger.create({ trigger: s, start: 'top 60%', toggleClass: { targets: s, className: 'is-lit' } })
    );
    return () => triggers.forEach((t) => t.kill());
  });
}

/**
 * Spend, reward, return — dealt in from the left.
 *
 * The three cards arrive like cards off a deck on the left edge, travelling
 * right into their slots with the scroll: each starts fully off to the left
 * of its own slot, tilted, and settles flat. Return has the furthest to go,
 * so the row reads left to right as the sequence it is. Scrubbed, so the
 * deal reverses on the way back up. Narrow screens stack the cards, so each
 * one simply slides in from the left as it arrives.
 */
export function initDeal() {
  if (!motionEnabled()) return;
  const steps = [...document.querySelectorAll('.howworks__step')];
  if (steps.length !== 3) return;
  const { gsap } = gsapReady();
  const mm = gsap.matchMedia();

  mm.add('(min-width: 861px)', () => {
    const tl = gsap.timeline({
      scrollTrigger: { trigger: steps[0].parentElement, start: 'top 98%', end: 'top 38%', scrub: 0.6 },
    });
    steps.forEach((s, i) => {
      // From just past the left edge of the viewport to its own slot.
      tl.fromTo(s,
        { x: () => -(s.getBoundingClientRect().left + s.offsetWidth + 40), rotation: -7 - i * 2, opacity: 0.4 },
        { x: 0, rotation: 0, opacity: 1, ease: 'power2.out', duration: 1 },
        i * 0.22);
    });
    return () => gsap.set(steps, { clearProps: 'transform,opacity' });
  });

  mm.add('(max-width: 860px)', () => {
    const tweens = steps.map((s) => gsap.fromTo(s, { x: -60, opacity: 0.3 }, {
      x: 0, opacity: 1, ease: 'none',
      scrollTrigger: { trigger: s, start: 'top 95%', end: 'top 60%', scrub: 0.5 },
    }));
    return () => { tweens.forEach((t) => t.scrollTrigger?.kill()); gsap.set(steps, { clearProps: 'transform,opacity' }); };
  });
}

export function initUplift() {
  const fig = document.querySelector('.bento__figure[data-range]');
  const svg = document.querySelector('.uplift');
  if (!fig || !svg || !motionEnabled()) return;

  const { gsap } = gsapReady();
  const [lo, hi] = fig.dataset.range.split(',').map(Number);
  const suffix = fig.dataset.suffix ?? '';
  const final = fig.textContent;
  const line = svg.querySelector('.uplift__line');
  const win = svg.querySelector('.uplift__window');
  const n = { lo: 0, hi: 0 };

  // Numbers play once: a figure should be read, not scrubbed back and forth.
  const tl = gsap.timeline({
    scrollTrigger: { trigger: svg, start: 'top 86%', once: true },
    onComplete: () => { fig.textContent = final; },
  });
  // The activation window rises first — it is the context the line moves in.
  tl.to(win, { '--win': 1, duration: 0.7, ease: 'power3.out' }, 0);
  tl.to(line, { '--draw': 0, duration: 1.4, ease: 'power2.inOut' }, 0.15);
  // The figure counts as the line climbs through the window (~40–60% of
  // the path), so the number arrives at the same moment as the lift.
  tl.to(n, {
    lo, hi, duration: 1.0, ease: 'power4.out',
    onUpdate: () => { fig.textContent = `${Math.round(n.lo)}–${Math.round(n.hi)}${suffix}`; },
  }, 0.45);
}
