import { motionEnabled } from './reveal.js';
import { MASK, OFFICES, LAND, VIEW_HOME } from './worldmap-data.js';

/**
 * #global — a globe that forms, turns to Amsterdam, and throws arcs to
 * every office; then the offices arrive as tiles, and the globe answers them.
 *
 * Scroll (scrubbed, reversible):
 *   0.00–0.40  the globe forms — its outline draws, land dots assemble in a
 *              scatter, and it spins in from the Pacific to face Europe
 *   0.35–0.80  pins light by distance from Amsterdam; arcs launch outward,
 *              lifted off the surface in proportion to how far they fly
 *   0.60       the office tiles arrive (time-based, staggered, reversible)
 * Settled (time-based; paused off screen and on a hidden tab):
 *   the globe turns to each office in turn, a packet flies the arc, and the
 *   matching tile carries a progress line to the next stop.
 * Hands on:
 *   hovering / focusing / pressing a tile turns the globe to that office;
 *   dragging the globe turns it, with momentum.
 *
 * Motion off: the globe is drawn once facing Europe, the tiles are there,
 * and a tile still turns the globe — instantly, not animated.
 */

const DEG = Math.PI / 180;
const CYCLE_MS = 3400;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (v) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const hash = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

function cssColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function rgba(hex, a) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** A 0.25° land raster drawn once from the coastline rings. O(1) lookups. */
function buildLandMask() {
  const RES = 4;
  const w = (MASK.lonMax - MASK.lonMin) * RES, h = (MASK.latMax - MASK.latMin) * RES;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  for (const ring of LAND) {
    ctx.beginPath();
    ring.forEach(([lon, lat], i) => {
      const x = (lon - MASK.lonMin) * RES, y = (MASK.latMax - lat) * RES;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  }
  const data = ctx.getImageData(0, 0, w, h).data;
  return (lon, lat) => {
    const x = Math.round((lon - MASK.lonMin) * RES), y = Math.round((MASK.latMax - lat) * RES);
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    return data[(y * w + x) * 4] > 127;
  };
}

const toVec = (lon, lat) => {
  const l = lon * DEG, p = lat * DEG;
  return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)];
};

/** Unit vectors along the great circle from a to b, t in 0..1 (slerp). */
function slerp(a, b, t) {
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const om = Math.acos(dot);
  if (om < 1e-6) return a;
  const s = Math.sin(om), k0 = Math.sin((1 - t) * om) / s, k1 = Math.sin(t * om) / s;
  return [a[0] * k0 + b[0] * k1, a[1] * k0 + b[1] * k1, a[2] * k0 + b[2] * k1];
}

function localTime(tz) {
  const d = new Date();
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  let offset = '';
  try {
    offset = new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch { /* time alone is enough */ }
  return { time, offset: offset.replace('GMT', 'UTC') || 'UTC' };
}

export function initNetwork() {
  const root = document.querySelector('.orbit');
  if (!root) return;
  const stage = root.querySelector('.orbit__globe');
  const canvas = stage.querySelector('canvas');
  const tileList = root.querySelector('.orbit__tiles');
  const tiles = [...root.querySelectorAll('.tile')];
  const utc = root.querySelector('.orbit__utc time');

  const motion = motionEnabled();
  const isLand = buildLandMask();
  const col = {
    dot: cssColor('--ink-3'), ink: cssColor('--ink'), accent: cssColor('--accent'),
    support: cssColor('--support'), canvas: cssColor('--canvas'),
  };
  const hqIdx = OFFICES.findIndex((o) => o.hq);
  const hq = OFFICES[hqIdx];

  // ---- sphere samples: a Fibonacci lattice gives an even, organic dot field
  const N = 15000;
  const land = [];
  const GA = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = GA * i;
    const x = Math.cos(th) * r, z = Math.sin(th) * r;
    const lat = Math.asin(y) / DEG, lon = Math.atan2(x, z) / DEG;
    if (isLand(lon, lat)) land.push({ v: [x, y, z], seed: hash(i) });
  }
  OFFICES.forEach((o) => { o._v = toVec(o.lon, o.lat); });
  const arcs = OFFICES.map((o, i) => {
    if (i === hqIdx) return null;
    const ang = Math.acos(Math.min(1, hq._v[0] * o._v[0] + hq._v[1] * o._v[1] + hq._v[2] * o._v[2]));
    return { i, ang, lift: 0.06 + 0.32 * (ang / Math.PI) };
  }).filter(Boolean);
  const maxAng = Math.max(...arcs.map((a) => a.ang));

  // ---- state
  const S = {
    p: motion ? 0 : 1,               // scroll reveal
    lon: motion ? -120 : VIEW_HOME.lon, // view centre
    lat: motion ? 8 : VIEW_HOME.lat,
    active: hqIdx,
    packet: -1, packetT: 0,          // arc index in flight, 0..1
    pulse: 0,                        // 0..1 ring on the active pin
  };
  let size = 0, dpr = 1, R = 0, cx = 0, cy = 0;
  let dirty = true;

  function layout() {
    size = stage.clientWidth;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.height = Math.round(size * dpr);
    R = size * 0.36; cx = size / 2; cy = size / 2;
    dirty = true;
  }

  // Rotate a world vector into view space for the current centre.
  let cl = 1, sl = 0, cp = 1, sp = 0;
  const setView = () => {
    const l = S.lon * DEG, p = S.lat * DEG;
    cl = Math.cos(l); sl = Math.sin(l); cp = Math.cos(p); sp = Math.sin(p);
  };
  const view = (v, r = 1) => {
    const x1 = v[0] * cl - v[2] * sl;
    const z1 = v[0] * sl + v[2] * cl;
    const y2 = v[1] * cp - z1 * sp;
    const z2 = v[1] * sp + z1 * cp;
    return [x1 * r, y2 * r, z2 * r];
  };
  const screen = (q) => [cx + R * q[0], cy - R * q[1]];
  // A lifted point is hidden only when it is behind the sphere's disc.
  const occluded = (q) => q[2] < 0 && q[0] * q[0] + q[1] * q[1] < 1;

  function draw() {
    setView();
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const p = S.p;

    // Formation: the globe grows in from 86%, its outline draws first.
    const form = smooth(p / 0.4);
    const scale = 0.86 + 0.14 * form;
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-cx, -cy);

    // Atmosphere — a soft accent rim, the one warm thing on a cool object.
    const atm = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.22);
    atm.addColorStop(0, rgba(col.accent, 0.22 * form));
    atm.addColorStop(1, rgba(col.accent, 0));
    ctx.fillStyle = atm;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.22, 0, Math.PI * 2); ctx.fill();

    // The body: light from the upper left, like the rest of the page's glass.
    const body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    body.addColorStop(0, rgba(col.canvas, 0.98 * form));
    body.addColorStop(1, rgba(col.support, 0.35 * form));
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = rgba(col.ink, 0.12);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * smooth(p / 0.18)); ctx.stroke();

    // Land. Dots assemble in a scatter (each has its own moment), and shade
    // toward the limb so the sphere reads as round, not as a disc.
    const BUCKETS = 5;
    const paths = Array.from({ length: BUCKETS }, () => new Path2D());
    const base = Math.max(0.8, R / 170);
    for (const d of land) {
      const q = view(d.v);
      if (q[2] <= 0.02) continue;
      const a = clamp01((p - (0.05 + d.seed * 0.28)) / 0.08);
      if (a <= 0) continue;
      const [x, y] = screen(q);
      const r = base * (0.55 + 0.6 * q[2]) * (0.4 + 0.6 * a);
      const b = Math.min(BUCKETS - 1, Math.floor(q[2] * a * BUCKETS));
      paths[b].moveTo(x + r, y);
      paths[b].arc(x, y, r, 0, Math.PI * 2);
    }
    paths.forEach((path, b) => {
      ctx.fillStyle = rgba(col.dot, 0.18 + 0.62 * ((b + 0.5) / BUCKETS));
      ctx.fill(path);
    });

    // Arcs, launched outward from Amsterdam by distance.
    for (const arc of arcs) {
      const f = smooth((p - (0.38 + 0.3 * (arc.ang / maxAng))) / 0.2);
      if (f <= 0) continue;
      const active = arc.i === S.active;
      ctx.strokeStyle = rgba(col.accent, active ? 0.95 : 0.55);
      ctx.lineWidth = active ? 2 : 1.25;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const STEPS = 64;
      let pen = false;
      for (let s = 0; s <= STEPS * f; s++) {
        const t = s / STEPS;
        const v = slerp(hq._v, OFFICES[arc.i]._v, t);
        const q = view(v, 1 + arc.lift * Math.sin(Math.PI * t));
        if (occluded(q)) { pen = false; continue; }
        const [x, y] = screen(q);
        if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true; }
      }
      ctx.stroke();
    }

    // Packet in flight.
    if (S.packet >= 0) {
      const arc = arcs.find((a) => a.i === S.packet);
      if (arc) {
        const t = S.packetT;
        const q = view(slerp(hq._v, OFFICES[arc.i]._v, t), 1 + arc.lift * Math.sin(Math.PI * t));
        if (!occluded(q)) {
          const [x, y] = screen(q);
          ctx.fillStyle = rgba(col.accent, 0.25);
          ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = col.accent;
          ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // Pins.
    OFFICES.forEach((o, i) => {
      const q = view(o._v);
      if (q[2] <= 0) return;
      const f = o.hq ? 1 : 0;
      const d = Math.acos(Math.min(1, hq._v[0] * o._v[0] + hq._v[1] * o._v[1] + hq._v[2] * o._v[2]));
      const a = clamp01((p - (0.34 + 0.3 * (d / maxAng) * (1 - f))) / 0.08);
      if (a <= 0) return;
      const [x, y] = screen(q);
      const edge = 0.45 + 0.55 * q[2];
      if (i === S.active) {
        ctx.strokeStyle = rgba(col.accent, (1 - S.pulse) * 0.8 * a);
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, 5 + 14 * S.pulse, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = rgba(col.accent, 0.3 * a * edge);
      ctx.beginPath(); ctx.arc(x, y, o.hq ? 8 : 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(i === S.active || o.hq ? col.accent : col.ink, a * edge);
      ctx.beginPath(); ctx.arc(x, y, o.hq ? 3.6 : 2.8, 0, Math.PI * 2); ctx.fill();
    });

    // A label on the active office — a small pill, the way a map UI would.
    const o = OFFICES[S.active];
    const q = view(o._v);
    if (q[2] > 0.15 && p > 0.6) {
      const [x, y] = screen(q);
      ctx.font = '600 12px "Neue Plak", Arial, sans-serif';
      const w = ctx.measureText(o.city).width + 18;
      const lx = Math.min(size - w - 4, x + 12), ly = y - 30;
      ctx.fillStyle = rgba(col.canvas, 0.94);
      ctx.strokeStyle = rgba(col.accent, 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(lx, ly, w, 22, 11); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col.ink;
      ctx.fillText(o.city, lx + 9, ly + 15);
    }
    ctx.restore();
  }

  // ---- tiles ------------------------------------------------------------------
  function writeTimes() {
    tiles.forEach((t) => {
      const o = OFFICES.find((x) => x.id === t.dataset.office);
      if (!o) return;
      const lt = localTime(o.tz);
      t.querySelector('.tile__time').textContent = lt.time;
      t.querySelector('.tile__off').textContent = lt.offset;
    });
    if (utc) utc.textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  }

  // ---- motion helpers -------------------------------------------------------
  const { gsap } = window;
  let turn = null;
  function turnTo(i, dur = 1.1) {
    const o = OFFICES[i];
    const lat = Math.max(-18, Math.min(42, o.lat));
    // Shortest way round.
    let dl = ((o.lon - S.lon + 540) % 360) - 180;
    if (!motion) { S.lon += dl; S.lat = lat; dirty = true; draw(); return; }
    turn?.kill();
    // On-screen movement: ease-in-out.
    turn = gsap.to(S, { lon: S.lon + dl, lat, duration: dur, ease: 'power3.inOut', onUpdate: () => { dirty = true; } });
  }

  let packetTween = null, pulseTween = null;
  function fly(i) {
    if (!motion || i === hqIdx) return;
    packetTween?.kill();
    S.packet = i; S.packetT = 0;
    packetTween = gsap.to(S, {
      packetT: 1, duration: 1.0, delay: 0.35, ease: 'power2.inOut',
      onUpdate: () => { dirty = true; },
      onComplete: () => { S.packet = -1; ping(); },
    });
  }
  function ping() {
    if (!motion) return;
    pulseTween?.kill();
    S.pulse = 0;
    pulseTween = gsap.to(S, { pulse: 1, duration: 1.1, ease: 'power2.out', onUpdate: () => { dirty = true; } });
  }

  function select(i, { from = 'auto', turn: doTurn = true } = {}) {
    S.active = i;
    tiles.forEach((t) => {
      const on = t.dataset.office === OFFICES[i].id;
      t.setAttribute('aria-pressed', on ? 'true' : 'false');
      t.classList.toggle('is-active', on);
      // Restart the progress line only for autoplay stops.
      t.classList.remove('is-timing');
      if (on && from === 'auto' && motion) { void t.offsetWidth; t.classList.add('is-timing'); }
    });
    if (doTurn) { turnTo(i); fly(i); }
    dirty = true;
  }

  // ---- autoplay ----------------------------------------------------------------
  let timer = 0, visible = false, holding = false, releaseTimer = 0;
  const canCycle = () => motion && visible && !holding && !document.hidden && S.p >= 0.999;
  function schedule() {
    clearTimeout(timer);
    root.classList.toggle('is-cycling', canCycle());
    if (!canCycle()) return;
    timer = setTimeout(() => {
      if (canCycle()) select((S.active + 1) % OFFICES.length);
      schedule();
    }, CYCLE_MS);
  }
  const hold = () => {
    holding = true; clearTimeout(releaseTimer); clearTimeout(timer);
    root.classList.remove('is-cycling');
  };
  const release = (ms = 2200) => {
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => { holding = false; schedule(); }, ms);
  };

  // ---- inputs --------------------------------------------------------------------
  tiles.forEach((t) => {
    const i = OFFICES.findIndex((o) => o.id === t.dataset.office);
    const pick = () => { hold(); if (S.active !== i) select(i, { from: 'user' }); };
    t.addEventListener('pointerenter', pick);
    t.addEventListener('focus', pick);
    t.addEventListener('click', pick);
    t.addEventListener('pointerleave', () => release());
    t.addEventListener('blur', () => release());
  });

  // Drag to turn, with momentum. Pointer capture keeps the drag alive when
  // the pointer leaves the globe; a flick carries on and decays.
  let drag = null, spin = null;
  stage.addEventListener('pointerdown', (e) => {
    if (S.p < 0.95) return;
    hold(); turn?.kill(); spin?.kill();
    stage.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, t: performance.now(), vx: 0, vy: 0 };
    stage.classList.add('is-dragging');
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const now = performance.now(), dt = Math.max(1, now - drag.t);
    const k = 180 / (R * Math.PI); // px → degrees at the equator
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    S.lon -= dx * k; S.lat = Math.max(-40, Math.min(70, S.lat + dy * k));
    drag.vx = (-dx * k) / dt; drag.vy = (dy * k) / dt;
    drag.x = e.clientX; drag.y = e.clientY; drag.t = now;
    dirty = true;
  });
  const endDrag = () => {
    if (!drag) return;
    const { vx, vy } = drag;
    drag = null;
    stage.classList.remove('is-dragging');
    if (motion && Math.hypot(vx, vy) > 0.01) {
      // Momentum: travel what the flick implies, decelerating.
      spin = gsap.to(S, {
        lon: S.lon + vx * 400, lat: Math.max(-40, Math.min(70, S.lat + vy * 400)),
        duration: 1.2, ease: 'power3.out', onUpdate: () => { dirty = true; },
      });
    }
    release(3000);
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  // ---- boot -------------------------------------------------------------------------
  layout();
  writeTimes();
  // Boot on the head office without turning: the scroll owns the view
  // until the reveal completes.
  select(hqIdx, { from: 'user', turn: false });
  if (!motion) {
    S.lon = VIEW_HOME.lon; S.lat = VIEW_HOME.lat;
    root.classList.add('is-in', 'is-settled');
    draw();
  }
  new ResizeObserver(() => { layout(); draw(); }).observe(stage);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) writeTimes();
    schedule();
  }).observe(root);
  document.addEventListener('visibilitychange', schedule);
  setInterval(() => { if (visible && !document.hidden) writeTimes(); }, 15000);

  if (!motion) return;

  gsap.ticker.add(() => { if (dirty && visible) { draw(); dirty = false; } });

  const ST = window.ScrollTrigger;
  gsap.registerPlugin(ST);
  let wasDone = false;
  gsap.to(S, {
    p: 1,
    ease: 'none', // the scroll is the clock
    onUpdate: () => {
      // The spin-in from the Pacific rides the same progress, eased on its
      // own so the globe decelerates into Europe rather than stopping dead.
      if (!drag && !turn?.isActive() && !spin?.isActive() && S.p < 0.999) {
        const e = smooth(S.p / 0.62);
        S.lon = -120 + (VIEW_HOME.lon + 120) * e;
        S.lat = 8 + (VIEW_HOME.lat - 8) * e;
      }
      root.classList.toggle('is-in', S.p >= 0.6);
      const done = S.p >= 0.999;
      root.classList.toggle('is-settled', done);
      if (done !== wasDone) schedule();
      wasDone = done;
      dirty = true;
    },
    scrollTrigger: { trigger: stage, start: 'top 90%', end: 'center 50%', scrub: 0.6 },
  });


}
