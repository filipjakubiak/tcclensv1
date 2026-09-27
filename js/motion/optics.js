import { motionEnabled } from './reveal.js';

/**
 * Optics — the page's text behaves like light through the lens it is built
 * around. One idea, five expressions of it, none of them decoration for its
 * own sake:
 *
 *   dispersion    a headline resolves with its colour split converging —
 *                 accent one side, Space Grey the other — the way glass
 *                 separates light before it focuses. Rides the existing
 *                 focus-pull; never a new entrance of its own.
 *   speed         the same split opens with scroll VELOCITY on the headlines
 *                 in view, and closes as the page comes to rest. Only while
 *                 moving fast — i.e. only while nobody is reading.
 *   focal plane   statements (pull quotes, the film's one sentence) are read
 *                 into focus word by word as they cross the viewport. The
 *                 focal word resolves last, out of a soft blur.
 *   calibration   section eyebrows resolve left to right like an instrument
 *                 finding its reading.
 *   recognise     the film's background word is swept by a band of focus as
 *                 the section passes, and resolves whole at the end.
 *
 * Every expression is bounded, reversible where scrubbed, and absent under
 * reduced motion / ?shot=1 — where the text simply sits sharp and complete.
 */

const { gsap } = window;

// ---- helpers ---------------------------------------------------------------

/** Wrap every word in a span, leaving existing inline elements intact as units. */
function splitWords(root) {
  const words = [];
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        const parts = child.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.append(part); continue; }
          const s = document.createElement('span');
          s.className = 'w';
          s.textContent = part;
          frag.append(s);
          words.push(s);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === 1) {
        // A focal word is one unit: splitting inside a background-clip:text
        // span would clip each piece to its own box and break the gradient.
        if (child.classList.contains('focus-word')) { child.classList.add('w'); words.push(child); }
        else walk(child);
      }
    }
  };
  walk(root);
  return words;
}

// ---- 1 · dispersion on arrival --------------------------------------------

function initDispersion() {
  gsap.utils.toArray('[data-focus-pull]').forEach((el) => {
    // The hero's letters carry their own split (hero-text.js).
    if (el.closest('#hero')) return;
    gsap.fromTo(el, { '--disp': 1 }, {
      '--disp': 0, duration: 1.2, ease: 'expo.out', delay: 0.1,
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    });
  });
}

// ---- 2 · dispersion under speed ---------------------------------------------

function initSpeed() {
  const { ScrollTrigger } = window;
  const heads = gsap.utils.toArray('[data-focus-pull]');
  const inView = new Set();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) inView.add(e.target);
      else { inView.delete(e.target); e.target.style.setProperty('--vel', 0); }
    }
  });
  heads.forEach((h) => io.observe(h));

  let target = 0, current = 0, last = -1;
  ScrollTrigger.create({
    trigger: document.body, start: 0, end: 'max',
    onUpdate: (self) => {
      // px/s → 0..1. Reading-speed scrolls stay near zero; a fling saturates.
      target = Math.min(1, Math.max(0, (Math.abs(self.getVelocity()) - 600) / 3400));
    },
  });
  // Test hook: a fling at a given strength, without depending on how fast
  // a headless browser can deliver wheel events.
  window.__tccOptics = { kick: (v) => { target = Math.min(1, Math.max(0, v)); } };

  gsap.ticker.add((_time, dt) => {
    // Time-based, not per-frame: at a low frame rate a per-frame factor
    // decays in seconds instead of a fraction of one, and the fringe
    // lingers on text the reader has already stopped on. Opens fast
    // (~60ms), closes slower (~220ms) — the glass settling.
    const tau = target > current ? 60 : 220;
    current += (target - current) * (1 - Math.exp(-dt / tau));
    target *= Math.exp(-dt / 120);
    const v = current < 0.005 ? 0 : +current.toFixed(3);
    if (v === last) return;
    last = v;
    // Written per heading in view, never on :root — a root variable would
    // recalculate style for the whole document every frame.
    for (const h of inView) h.style.setProperty('--vel', v);
  });
}

// ---- 3 · focal plane --------------------------------------------------------

function initFocalPlane() {
  const targets = document.querySelectorAll('.pullquote, .film__quote blockquote');
  targets.forEach((el) => {
    const words = splitWords(el);
    if (!words.length) return;
    const tl = gsap.timeline({
      scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 52%', scrub: 0.5 },
    });
    // The scroll is the reading pace: linear, word by word, in reading
    // order. A focal word resolves at its own place in the sentence — out of
    // a soft blur and over a longer stretch, so it is the last to sharpen
    // without leaving a hole in the line while the words after it arrive.
    const STEP = 0.12;
    words.forEach((w, i) => {
      if (w.classList.contains('focus-word')) {
        tl.fromTo(w, { opacity: 0.16, filter: 'blur(6px)' },
          { opacity: 1, filter: 'blur(0px)', ease: 'none', duration: 1.4 }, i * STEP);
      } else {
        tl.fromTo(w, { opacity: 0.16 }, { opacity: 1, ease: 'none', duration: 0.5 }, i * STEP);
      }
    });
  });
}

// ---- 5 · calibration ---------------------------------------------------------

function initCalibration() {
  const eyebrows = [...document.querySelectorAll('section > .container .eyebrow, section .eyebrow')]
    .filter((e, i, all) => all.indexOf(e) === i)
    .filter((e) => !e.closest('[data-lift]') && !e.closest('#hero') && !e.closest('.toast'));

  eyebrows.forEach((eb) => {
    const text = eb.textContent;
    if (!text.trim() || eb.children.length) return;
    eb.textContent = '';
    // The overlay shares the real text's own box (not the block's), so a
    // centred eyebrow calibrates in place instead of from the left edge.
    const wrap = document.createElement('span');
    wrap.className = 'eb__wrap';
    const real = document.createElement('span');
    real.className = 'eb__real';
    real.textContent = text;
    const fx = document.createElement('span');
    fx.className = 'eb__fx';
    fx.setAttribute('aria-hidden', 'true');
    wrap.append(real, fx);
    eb.append(wrap);

    // Scramble only through the eyebrow's own letters: it reads as the same
    // words finding their order, not as random noise.
    const pool = text.replace(/\s/g, '').split('');
    const n = text.length;
    const state = { t: 0 };
    gsap.to(state, {
      t: 1, duration: 0.75, ease: 'power2.out',
      scrollTrigger: { trigger: eb, start: 'top 88%', once: true },
      onStart: () => eb.classList.add('is-calibrating'),
      onUpdate: () => {
        let out = '';
        for (let i = 0; i < n; i++) {
          const ch = text[i];
          const at = (i / n) * 0.75 + 0.2; // left to right
          out += ch === ' ' || state.t >= at ? ch : pool[(Math.random() * pool.length) | 0];
        }
        fx.textContent = out;
      },
      onComplete: () => { eb.classList.remove('is-calibrating'); fx.textContent = ''; },
    });
  });
}

// ---- 6 · recognise -------------------------------------------------------------

function initRecognise() {
  const word = document.querySelector('.film__word');
  if (!word) return;
  const text = word.textContent.trim();
  word.textContent = '';
  const letters = [...text].map((ch) => {
    const s = document.createElement('span');
    s.textContent = ch;
    word.append(s);
    return s;
  });
  const n = letters.length;
  const S = { p: 0 };
  const render = () => {
    // A band of focus crosses the word; past 0.85 the whole word is held.
    const whole = Math.min(1, Math.max(0, (S.p - 0.82) / 0.14));
    letters.forEach((l, i) => {
      const c = (i + 0.5) / n;
      const band = Math.exp(-(((c - (S.p * 1.2 - 0.1)) / 0.13) ** 2));
      const v = Math.max(band, whole);
      l.style.opacity = (0.25 + 0.75 * v).toFixed(3);
      l.style.transform = `translateY(${((1 - v) * 0.04).toFixed(3)}em)`;
    });
    word.style.letterSpacing = `${(0.06 - 0.1 * S.p).toFixed(3)}em`;
  };
  render();
  gsap.to(S, {
    p: 1, ease: 'none', onUpdate: render,
    scrollTrigger: { trigger: '#film', start: 'top 70%', end: 'bottom 40%', scrub: 0.6 },
  });
}

export function initOptics() {
  if (!motionEnabled()) return;
  gsap.registerPlugin(window.ScrollTrigger);
  initDispersion();
  initSpeed();
  initFocalPlane();
  initCalibration();
  initRecognise();
}
