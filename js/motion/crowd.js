import { motionEnabled } from './reveal.js';

/**
 * #proof, the 1B+ cell — a billion shoppers, shown as a crowd that is
 * actually doing something.
 *
 *   The field   a dot per shopper-cohort. The scroll fills it (scrubbed,
 *               reversible): dots join left to right with scatter, the way a
 *               campaign spreads, not as a wipe.
 *   The lens    under a fine pointer, dots near the cursor magnify — the
 *               page's recurring device at the scale of a component.
 *   The feed    a stack of notifications in the language of the product
 *               TCC builds (stamps, rewards, give-backs). Each arrival sets
 *               off a ripple at a dot, so the feed and the crowd are one
 *               system rather than two decorations. Time-based; pauses off
 *               screen and on a hidden tab.
 *   The figure  counts through the millions and lands on the copy's "1B+".
 *
 * Motion off: a full field, three stacked notifications, "1B+". Decorative
 * throughout (aria-hidden) — the cell's label and caption carry the claim.
 */

// The product's own vocabulary, placed in cities the page names.
const EVENTS = [
  ['Reward redeemed', 'Warsaw'],
  ['Stamp collected', 'Amsterdam'],
  ['Collection complete', 'Adelaide'],
  ['Give-back donated', 'Düsseldorf'],
  ['Bonus points earned', 'Milan'],
  ['Gift claimed', 'Sydney'],
  ['Shopper returned', 'London'],
  ['Card completed', 'Hong Kong'],
];
const FEED_MS = 2600;
const VISIBLE = 3;
const PITCH = 11;

function cssColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function rgba(hex, a) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
// Deterministic scatter, so the fill pattern is the same every visit.
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function toastNode([title, city]) {
  const li = document.createElement('li');
  li.className = 'toast';
  li.innerHTML = '<span class="toast__mark"></span><span class="toast__text"><b></b><span></span></span><time>now</time>';
  li.querySelector('b').textContent = title;
  li.querySelector('.toast__text span').textContent = city;
  return li;
}

export function initCrowd() {
  const box = document.querySelector('.crowd');
  const fig = document.querySelector('.bento__figure[data-count-billion]');
  if (!box) return;
  const canvas = box.querySelector('canvas');
  const list = box.querySelector('.toasts');
  const motion = motionEnabled();
  const col = { dot: cssColor('--ink-3'), accent: cssColor('--accent') };

  // ---- field ----------------------------------------------------------------
  let W = 0, H = 0, dpr = 1, dots = [];
  const S = { fill: motion ? 0 : 1, px: -999, py: -999, lensA: 0 };
  const ripples = []; // { x, y, t0 }
  let dirty = true;

  function layout() {
    W = box.clientWidth; H = box.clientHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    dots = [];
    const cols = Math.floor(W / PITCH), rows = Math.floor(H / PITCH);
    const ox = (W - (cols - 1) * PITCH) / 2, oy = (H - (rows - 1) * PITCH) / 2;
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++, i++) {
        const x = ox + c * PITCH, y = oy + r * PITCH;
        // Join order: mostly left-to-right, with enough scatter to read as
        // people arriving rather than a progress bar.
        dots.push({ x, y, rank: (x / W) * 0.62 + hash(i) * 0.38 });
      }
    }
    dirty = true;
  }

  function draw(now) {
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const LENS_R = 64;
    const idle = rgba(col.dot, 0.28);
    for (const d of dots) {
      // How joined this dot is: a soft edge rather than a hard threshold.
      const j = Math.min(1, Math.max(0, (S.fill * 1.15 - d.rank) / 0.15));
      let r = 1.1 + 0.5 * j;
      let a = 0.28 + 0.62 * j;
      let x = d.x, y = d.y;
      // The lens: magnify and push outward a touch, like glass would.
      if (S.lensA > 0) {
        const dx = d.x - S.px, dy = d.y - S.py, dist = Math.hypot(dx, dy);
        if (dist < LENS_R) {
          const f = (1 - dist / LENS_R) ** 2 * S.lensA;
          r *= 1 + 1.6 * f;
          x += dx * 0.18 * f; y += dy * 0.18 * f;
          a = Math.min(1, a + 0.3 * f);
        }
      }
      for (const rp of ripples) {
        const age = (now - rp.t0) / 900;
        if (age >= 1) continue;
        const ring = age * 46, dist = Math.hypot(d.x - rp.x, d.y - rp.y);
        const band = 1 - Math.min(1, Math.abs(dist - ring) / 8);
        if (band > 0) { const k = band * (1 - age); r *= 1 + 0.9 * k; a = Math.min(1, a + 0.5 * k); }
      }
      ctx.fillStyle = j > 0.02 ? rgba(col.accent, a) : idle;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  layout();
  new ResizeObserver(() => { layout(); if (!motion) draw(0); }).observe(box);

  // ---- feed -----------------------------------------------------------------
  let next = 0;
  const stackUp = () => {
    [...list.children].forEach((li, i) => {
      li.dataset.i = i;
      if (i >= VISIBLE) {
        li.dataset.i = VISIBLE; // exiting
        setTimeout(() => li.remove(), 420);
      }
    });
  };
  function push() {
    const li = toastNode(EVENTS[next % EVENTS.length]);
    next++;
    li.dataset.i = 'enter';
    list.prepend(li);
    // One frame in the entering state, then let the transition carry it —
    // transitions, not keyframes, so a rapid push retargets cleanly.
    requestAnimationFrame(() => requestAnimationFrame(stackUp));
    // The feed and the crowd are one system: an event lights a joined dot.
    const joined = dots.filter((d) => d.rank < S.fill);
    if (joined.length) {
      const d = joined[Math.floor(hash(next * 7.3) * joined.length)];
      ripples.push({ x: d.x, y: d.y, t0: performance.now() });
      if (ripples.length > 4) ripples.shift();
    }
  }

  // Seed the stack so the cell never shows an empty feed.
  for (let i = 0; i < VISIBLE; i++) {
    const li = toastNode(EVENTS[(VISIBLE - 1 - i) % EVENTS.length]);
    list.append(li);
  }
  next = VISIBLE;
  stackUp();

  if (!motion) { draw(0); box.classList.add('is-settled'); return; }

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  gsap.to(S, {
    fill: 1, ease: 'none',
    onUpdate: () => { dirty = true; },
    scrollTrigger: { trigger: box, start: 'top 85%', end: 'bottom 45%', scrub: 0.6 },
  });

  gsap.ticker.add(() => {
    const now = performance.now();
    const rippling = ripples.some((r) => now - r.t0 < 900);
    if (dirty || rippling) { draw(now); dirty = false; }
  });

  // Lens under the pointer, springing after it rather than glued to it.
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const cell = box.closest('.bento__cell');
    const qx = gsap.quickTo(S, 'px', { duration: 0.35, ease: 'power3.out', onUpdate: () => { dirty = true; } });
    const qy = gsap.quickTo(S, 'py', { duration: 0.35, ease: 'power3.out', onUpdate: () => { dirty = true; } });
    cell.addEventListener('pointermove', (e) => {
      const r = box.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (S.lensA === 0) { S.px = x; S.py = y; }
      qx(x); qy(y);
    });
    cell.addEventListener('pointerenter', () => gsap.to(S, { lensA: 1, duration: 0.3, ease: 'power2.out', onUpdate: () => { dirty = true; } }));
    cell.addEventListener('pointerleave', () => gsap.to(S, { lensA: 0, duration: 0.25, ease: 'power2.out', onUpdate: () => { dirty = true; } }));
  }

  // Feed only runs while the cell is on screen and the tab is visible.
  let timer = 0, visible = false;
  const run = () => {
    clearInterval(timer);
    if (visible && !document.hidden) timer = setInterval(push, FEED_MS);
  };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }, { threshold: 0.25 }).observe(box);
  document.addEventListener('visibilitychange', run);

  // The figure runs through the millions and lands on the copy.
  if (fig) {
    const final = fig.textContent;
    const n = { v: 0 };
    gsap.to(n, {
      v: 1000, duration: 1.8, ease: 'power4.out',
      onUpdate: () => { fig.textContent = n.v >= 999.5 ? final : `${Math.round(n.v)}M+`; },
      onComplete: () => { fig.textContent = final; },
      scrollTrigger: { trigger: fig, start: 'top 88%', once: true },
    });
  }
}
