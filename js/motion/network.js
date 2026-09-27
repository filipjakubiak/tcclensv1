import { motionEnabled } from './reveal.js';
import { FRAME, OFFICES, LAND, LENS_HOME } from './worldmap-data.js';

/**
 * #global — the offices as a live network interface.
 *
 * The section claims "twenty offices, one team" and until now showed a list.
 * This draws the claim: a dot-matrix world, Amsterdam at the centre, arcs
 * out to each named office, and a LENS — the page's one recurring device —
 * that magnifies the European cluster where five offices sit too close to
 * read at world scale. The lens is steerable: it follows the pointer, and it
 * glides to whichever office the list or the map is pointing at.
 *
 * Scroll (scrubbed, reversible): land resolves as a wave from Amsterdam,
 *   pins arrive by distance, arcs draw outward, the lens opens last.
 * After the reveal (time-based, paused off-screen and on hidden tabs): the
 *   readout cycles the offices — local time, UTC offset — a packet travels
 *   the arc and the lens follows it.
 * Pointer / keyboard: hovering or focusing an office row, or pointing at a
 *   pin, selects that office; the list and the map stay in sync.
 *
 * Motion off (reduced motion, ?shot=1): the finished map is drawn once, the
 * lens rests on Europe, selection still works — it simply doesn't travel.
 */

const LON_SPAN = FRAME.lonMax - FRAME.lonMin;
const LAT_SPAN = FRAME.latMax - FRAME.latMin;
const WORLD_PITCH = 1.6; // degrees between land dots in the world view
const ZOOM = 3.2;        // lens magnification; its pitch is WORLD_PITCH / ZOOM
const CYCLE_MS = 2800;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (v) => { const t = clamp01(v); return t * t * (3 - 2 * t); };

function cssColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function rgba(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** A 0.25° land raster, drawn once from the coastline rings. O(1) lookups. */
function buildLandMask() {
  const RES = 4; // px per degree
  const w = LON_SPAN * RES, h = LAT_SPAN * RES;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  for (const ring of LAND) {
    ctx.beginPath();
    ring.forEach(([lon, lat], i) => {
      const x = (lon - FRAME.lonMin) * RES, y = (FRAME.latMax - lat) * RES;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  }
  const data = ctx.getImageData(0, 0, w, h).data;
  return (lon, lat) => {
    const x = Math.round((lon - FRAME.lonMin) * RES), y = Math.round((FRAME.latMax - lat) * RES);
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    return data[(y * w + x) * 4] > 127;
  };
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  parent?.appendChild(n);
  return n;
};

/** A quadratic arc from a to b that lifts in proportion to its length. */
function arcPath(a, b) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${mx.toFixed(1)} ${(my - d * 0.32).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

function localTime(tz) {
  const d = new Date();
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  let offset = '';
  try {
    offset = new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch { /* older engines: time alone is enough */ }
  return { time, offset: offset.replace('GMT', 'UTC') || 'UTC' };
}

export function initNetwork() {
  const root = document.querySelector('.netmap');
  if (!root) return;
  const stage = root.querySelector('.netmap__stage');
  const land = stage.querySelector('.netmap__land');
  const net = stage.querySelector('.netmap__net');
  const lens = stage.querySelector('.netmap__lens');
  const lensLand = lens.querySelector('canvas');
  const lensNet = lens.querySelector('svg');
  const readout = root.querySelector('.netmap__readout');
  const rows = [...document.querySelectorAll('.global__offices li')];
  const utc = root.querySelector('.netmap__utc time');

  const motion = motionEnabled();
  const isLand = buildLandMask();
  const hq = OFFICES.find((o) => o.hq);
  const col = { dot: cssColor('--ink-3'), accent: cssColor('--accent'), ink: cssColor('--ink') };

  // ---- geometry, recomputed on resize -----------------------------------
  let W = 0, H = 0, k = 0, dpr = 1, L = 0; // k = px per degree in the world view
  let dots = [];      // world land dots: { x, y, d } — d = distance from HQ, px
  let maxD = 1;
  const proj = (lon, lat) => ({ x: (lon - FRAME.lonMin) * k, y: (FRAME.latMax - lat) * k });
  const unproj = (x, y) => ({ lon: x / k + FRAME.lonMin, lat: FRAME.latMax - y / k });

  // ---- live state -------------------------------------------------------
  const S = {
    p: motion ? 0 : 1,  // scroll reveal progress
    lx: 0, ly: 0,       // lens centre, px in the world view
    active: 0,          // index into OFFICES
  };
  let worldCache = null; // the finished land layer, blitted once reveal completes
  let lensDirty = true, worldDirty = true;

  // SVG handles, built once
  const W_ARCS = [], W_PINS = [], L_ARCS = [], L_PINS = [];
  const packet = el('circle', { r: 3, class: 'netmap__packet' });

  function buildSvg(svg, arcs, pins, labels) {
    svg.replaceChildren();
    const gA = el('g', { class: 'netmap__arcs' }, svg);
    const gP = el('g', { class: 'netmap__pins' }, svg);
    OFFICES.forEach((o, i) => {
      arcs[i] = o.hq ? null : el('path', { pathLength: 1, class: 'netmap__arc' }, gA);
      const g = el('g', { class: `netmap__pin${o.hq ? ' is-hq' : ''}`, 'data-i': i }, gP);
      el('circle', { r: o.hq ? 9 : 7, class: 'netmap__halo' }, g);
      el('circle', { r: o.hq ? 4 : 3, class: 'netmap__core' }, g);
      if (labels(o)) {
        // Offices near the right edge label to the left, or the frame cuts them.
        const east = o.lon > 140;
        const t = el('text', { class: 'netmap__label', x: east ? -9 : 9, y: -9, 'text-anchor': east ? 'end' : 'start' }, g);
        t.textContent = o.city;
      }
      pins[i] = g;
    });
    return gA;
  }
  const worldArcs = buildSvg(net, W_ARCS, W_PINS, (o) => !['lon', 'dus', 'mil', 'man'].includes(o.id));
  worldArcs.appendChild(packet);
  buildSvg(lensNet, L_ARCS, L_PINS, () => true);

  function layout() {
    const r = stage.getBoundingClientRect();
    W = r.width; H = r.height; k = W / LON_SPAN;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    L = lens.offsetWidth;
    for (const c of [land]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    lensLand.width = lensLand.height = Math.round(L * dpr);
    net.setAttribute('viewBox', `0 0 ${W} ${H}`);
    lensNet.setAttribute('viewBox', `0 0 ${L} ${L}`);

    const h = proj(hq.lon, hq.lat);
    dots = [];
    for (let lat = FRAME.latMax - WORLD_PITCH / 2; lat > FRAME.latMin; lat -= WORLD_PITCH) {
      for (let lon = FRAME.lonMin + WORLD_PITCH / 2; lon < FRAME.lonMax; lon += WORLD_PITCH) {
        if (!isLand(lon, lat)) continue;
        const q = proj(lon, lat);
        dots.push({ x: q.x, y: q.y, d: Math.hypot(q.x - h.x, q.y - h.y) });
      }
    }
    maxD = Math.max(...dots.map((d) => d.d), 1);

    OFFICES.forEach((o, i) => {
      const q = proj(o.lon, o.lat);
      o._x = q.x; o._y = q.y; o._d = Math.hypot(q.x - h.x, q.y - h.y);
      W_PINS[i].setAttribute('transform', `translate(${q.x.toFixed(1)} ${q.y.toFixed(1)})`);
      if (W_ARCS[i]) W_ARCS[i].setAttribute('d', arcPath(h, q));
    });

    worldCache = null;
    worldDirty = lensDirty = true;
  }

  // ---- drawing -----------------------------------------------------------
  const DOT_R = () => Math.max(0.9, k * WORLD_PITCH * 0.2);

  function drawWorld() {
    const ctx = land.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const done = S.p >= 0.999;
    if (done && worldCache) { ctx.drawImage(worldCache, 0, 0, W, H); return; }

    // The land resolves as a wave travelling out from the head office.
    const R = smooth(S.p / 0.55) * (maxD + 60);
    const r = DOT_R();
    ctx.fillStyle = rgba(col.dot, 0.55);
    ctx.beginPath();
    for (const d of dots) {
      const a = clamp01((R - d.d) / 60);
      if (a <= 0) continue;
      const rr = r * (0.55 + 0.45 * a);
      ctx.moveTo(d.x + rr, d.y);
      ctx.arc(d.x, d.y, rr, 0, Math.PI * 2);
    }
    ctx.fill();

    // The wavefront itself, faintly — the one frame that says "from here".
    if (S.p > 0.01 && S.p < 0.6) {
      const h = proj(hq.lon, hq.lat);
      ctx.strokeStyle = rgba(col.accent, 0.35 * (1 - S.p / 0.6));
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(h.x, h.y, R, 0, Math.PI * 2); ctx.stroke();
    }

    if (done) {
      worldCache = document.createElement('canvas');
      worldCache.width = land.width; worldCache.height = land.height;
      worldCache.getContext('2d').drawImage(land, 0, 0);
    }
  }

  function drawLens() {
    const c = unproj(S.lx, S.ly);
    const kk = k * ZOOM;
    const half = L / 2;
    const ctx = lensLand.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, L, L);

    // Dots sit on a fixed geographic lattice so they slide under the glass
    // as it moves, rather than being re-sampled around it.
    const pitch = WORLD_PITCH / ZOOM;
    const spanDeg = half / kk + pitch;
    const lon0 = Math.floor((c.lon - spanDeg) / pitch) * pitch;
    const lat0 = Math.floor((c.lat - spanDeg) / pitch) * pitch;
    const r = DOT_R();
    ctx.fillStyle = rgba(col.dot, 0.7);
    ctx.beginPath();
    for (let lat = lat0; lat <= c.lat + spanDeg; lat += pitch) {
      for (let lon = lon0; lon <= c.lon + spanDeg; lon += pitch) {
        if (!isLand(lon, lat)) continue;
        const x = half + (lon - c.lon) * kk, y = half - (lat - c.lat) * kk;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();

    const at = (o) => ({ x: half + (o.lon - c.lon) * kk, y: half - (o.lat - c.lat) * kk });
    const h = at(hq);
    OFFICES.forEach((o, i) => {
      const q = at(o);
      L_PINS[i].setAttribute('transform', `translate(${q.x.toFixed(1)} ${q.y.toFixed(1)})`);
      if (L_ARCS[i]) L_ARCS[i].setAttribute('d', arcPath(h, q));
    });
  }

  // Everything the scroll reveal controls, as a pure function of S.p.
  function applyReveal() {
    const p = S.p;
    OFFICES.forEach((o, i) => {
      const f = o._d / maxD;
      const pin = clamp01((p - (0.1 + 0.4 * f)) / 0.1);
      const arc = smooth((p - (0.28 + 0.4 * f)) / 0.24);
      for (const g of [W_PINS[i], L_PINS[i]]) {
        g.style.setProperty('--pin', pin.toFixed(3));
      }
      for (const a of [W_ARCS[i], L_ARCS[i]]) a?.style.setProperty('--draw', (1 - arc).toFixed(3));
    });
    // The lens opens last, as an iris: clip first, then the glass settles.
    const lensP = smooth((p - 0.7) / 0.25);
    lens.style.setProperty('--open', lensP.toFixed(3));
  }

  // ---- lens motion ----------------------------------------------------------
  const home = () => proj(LENS_HOME.lon, LENS_HOME.lat);
  function placeLens(x, y) {
    // Keep the whole glass inside the stage.
    const half = L / 2;
    S.lx = Math.min(W - half, Math.max(half, x));
    S.ly = Math.min(H - half, Math.max(half, y));
    lens.style.transform = `translate(${(S.lx - half).toFixed(1)}px, ${(S.ly - half).toFixed(1)}px)`;
    lensDirty = true;
  }
  const lensTo = { x: 0, y: 0 };
  let lensTween = null;
  function glideLens(x, y, dur = 0.9) {
    if (!motion) { placeLens(x, y); return; }
    lensTween?.kill();
    lensTo.x = S.lx; lensTo.y = S.ly;
    // On-screen movement: ease-in-out, so it leaves and lands gently.
    lensTween = window.gsap.to(lensTo, {
      x, y, duration: dur, ease: 'power3.inOut',
      onUpdate: () => placeLens(lensTo.x, lensTo.y),
    });
  }

  // ---- selection -----------------------------------------------------------
  const R_CITY = readout.querySelector('.netmap__city');
  const R_META = readout.querySelector('.netmap__meta');
  const R_TIME = readout.querySelector('.netmap__time');
  const R_OFF = readout.querySelector('.netmap__offset');
  let swapTimer = 0;

  function writeReadout(o) {
    const t = localTime(o.tz);
    R_CITY.textContent = o.city;
    R_META.textContent = o.meta;
    R_TIME.textContent = t.time;
    R_OFF.textContent = t.offset;
  }

  function select(i, { glide = true, from = 'auto' } = {}) {
    const o = OFFICES[i];
    const changed = i !== S.active;
    S.active = i;
    [...W_PINS, ...L_PINS].forEach((g) => g.classList.toggle('is-active', +g.dataset.i === i));
    rows.forEach((r, j) => r.classList.toggle('is-net-active', j === i));

    if (changed && motion) {
      // Blur bridges the crossfade so it reads as one readout changing,
      // not two overlapping (fast — this is feedback, not a flourish).
      readout.classList.add('is-swapping');
      clearTimeout(swapTimer);
      swapTimer = setTimeout(() => { writeReadout(o); readout.classList.remove('is-swapping'); }, 140);
    } else writeReadout(o);

    if (glide && from !== 'pointer') glideLens(o._x, o._y);
    if (changed && motion && !o.hq && S.p >= 0.999) sendPacket(i);
  }

  let packetTween = null;
  function sendPacket(i) {
    const path = W_ARCS[i];
    if (!path) return;
    packetTween?.kill();
    const len = path.getTotalLength();
    const s = { t: 0 };
    packet.style.opacity = 1;
    packetTween = window.gsap.to(s, {
      t: 1, duration: 0.9, ease: 'power2.inOut',
      onUpdate: () => {
        const q = path.getPointAtLength(len * s.t);
        packet.setAttribute('cx', q.x); packet.setAttribute('cy', q.y);
      },
      onComplete: () => {
        packet.style.opacity = 0;
        for (const g of [W_PINS[i], L_PINS[i]]) {
          g.classList.remove('is-ping'); void g.getBoundingClientRect(); g.classList.add('is-ping');
        }
      },
    });
  }

  // ---- autoplay -------------------------------------------------------------
  let cycleTimer = 0, visible = false, holding = false;
  const canCycle = () => motion && visible && !holding && !document.hidden && S.p >= 0.999;
  function schedule() {
    clearTimeout(cycleTimer);
    if (!canCycle()) return;
    cycleTimer = setTimeout(() => {
      if (canCycle()) select((S.active + 1) % OFFICES.length);
      schedule();
    }, CYCLE_MS);
  }
  let releaseTimer = 0;
  const hold = () => { holding = true; clearTimeout(releaseTimer); clearTimeout(cycleTimer); };
  const release = (delay = 1600) => {
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => { holding = false; schedule(); }, delay);
  };

  // ---- inputs ----------------------------------------------------------------
  rows.forEach((row, j) => {
    const i = OFFICES.findIndex((o) => o.city === row.firstElementChild?.textContent.trim());
    if (i < 0) return;
    const on = () => { hold(); select(i); };
    row.addEventListener('pointerenter', on);
    row.addEventListener('focus', on);
    row.addEventListener('pointerleave', () => release());
    row.addEventListener('blur', () => release());
  });

  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (fine) {
    stage.addEventListener('pointermove', (e) => {
      if (S.p < 0.95) return;
      hold();
      const r = stage.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (motion) { lensTween?.kill(); lensTo.x = S.lx; lensTo.y = S.ly; lensTween = window.gsap.to(lensTo, { x, y, duration: 0.5, ease: 'power3.out', onUpdate: () => placeLens(lensTo.x, lensTo.y) }); }
      else placeLens(x, y);
      // Snap the readout to whatever office the glass is over.
      const c = unproj(x, y);
      let best = -1, bestD = Infinity;
      OFFICES.forEach((o, i) => {
        const d = Math.hypot((o.lon - c.lon), (o.lat - c.lat));
        if (d < bestD) { bestD = d; best = i; }
      });
      const reach = (L / 2) / (k * ZOOM); // degrees visible under the glass
      if (best >= 0 && bestD < reach && best !== S.active) select(best, { from: 'pointer' });
    });
    stage.addEventListener('pointerleave', () => {
      if (S.p < 0.95) return;
      const o = OFFICES[S.active];
      glideLens(o._x, o._y, 0.7);
      release(900);
    });
  }

  // ---- clocks ------------------------------------------------------------------
  const tickClocks = () => {
    if (utc) utc.textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    const t = localTime(OFFICES[S.active].tz);
    R_TIME.textContent = t.time;
  };
  tickClocks();
  setInterval(() => { if (visible && !document.hidden) tickClocks(); }, 15000);

  // ---- frame loop --------------------------------------------------------------
  const frame = () => {
    if (worldDirty) { drawWorld(); worldDirty = false; }
    if (lensDirty) { drawLens(); lensDirty = false; }
  };

  layout();
  const h0 = home();
  placeLens(h0.x, h0.y);
  applyReveal();
  select(0, { glide: false });
  frame();

  new ResizeObserver(() => {
    layout();
    const o = OFFICES[S.active];
    placeLens(S.p >= 0.999 ? o._x : h0.x, S.p >= 0.999 ? o._y : h0.y);
    applyReveal();
    frame();
  }).observe(stage);

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    root.classList.toggle('is-visible', visible);
    if (visible) { tickClocks(); schedule(); } else clearTimeout(cycleTimer);
  }).observe(root);
  document.addEventListener('visibilitychange', schedule);

  if (!motion) { root.classList.add('is-settled'); return; }

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  gsap.ticker.add(frame);

  let wasDone = false;
  gsap.to(S, {
    p: 1,
    ease: 'none', // the scroll is the clock (progress visualisation)
    onUpdate: () => {
      applyReveal();
      worldDirty = true;
      const done = S.p >= 0.999;
      root.classList.toggle('is-settled', done);
      if (done && !wasDone) schedule();
      if (!done) clearTimeout(cycleTimer);
      wasDone = done;
    },
    scrollTrigger: { trigger: stage, start: 'top 88%', end: 'center 48%', scrub: 0.6 },
  });

  // The header figures count once, like every other figure on the page.
  root.querySelectorAll('[data-net-count]').forEach((n) => {
    const to = Number(n.dataset.netCount);
    const box = { v: 0 };
    gsap.to(box, {
      v: to, duration: 1.4, ease: 'power4.out',
      onUpdate: () => { n.textContent = Math.round(box.v); },
      onComplete: () => { n.textContent = to; },
      scrollTrigger: { trigger: root, start: 'top 80%', once: true },
    });
  });
}
