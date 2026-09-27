import { motionEnabled } from './reveal.js';

/**
 * #what-we-do — "The Aisle".
 *
 * The section's own words: "Whichever side of the aisle you're on… We sit
 * between the two — designing campaigns that serve the retailer's numbers
 * and the brand's story at the same time." So that is what it draws:
 *
 *   1  The two panels arrive closed together, like the hero's curtain, and
 *      part to either side — opening the aisle between them.
 *   2  TCC appears in the aisle and a spine runs down it.
 *   3  Wires run out from the spine to every promise on BOTH sides; each
 *      one lights as its wire lands. One source, two audiences.
 *   4  Settled: current runs out along the wires to both sides at once —
 *      "at the same time", literally — while the section is on screen.
 *
 * Scrubbed and reversible. Narrow screens stack the panels, so there is no
 * aisle: the promises simply light as they reach the middle of the screen.
 * Motion off: panels in place, wires drawn, every promise lit.
 */

const NS = 'http://www.w3.org/2000/svg';
const PULSE_MS = 2600;

export function initAisle() {
  const grid = document.querySelector('.fork__grid');
  const svg = grid?.querySelector('.aisle__wires');
  const aisle = grid?.querySelector('.aisle');
  if (!svg || !aisle) return;
  const node = aisle.querySelector('.aisle__node');
  const left = grid.querySelector('.fork__panel--retail');
  const right = grid.querySelector('.fork__panel--brand');
  const points = [
    ...[...left.querySelectorAll('.fork__points li')].map((li) => ({ li, side: -1, panel: left })),
    ...[...right.querySelectorAll('.fork__points li')].map((li) => ({ li, side: 1, panel: right })),
  ];
  const motion = motionEnabled();

  let spine = null, wires = [], ports = [], joints = [], pulses = [];
  const geo = { cx: 0, top: 0, bottom: 0 };

  /** Everything measured from layout, never from transformed boxes. */
  function build() {
    svg.replaceChildren();
    const w = grid.offsetWidth, h = grid.offsetHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    geo.cx = aisle.offsetLeft + aisle.offsetWidth / 2;
    geo.top = node.offsetTop + node.offsetHeight + 6;

    // Each promise's bullet, in grid coordinates: panel offset + body offset
    // + the li's own offset, via offsetTop chains (transform-free).
    const yOf = (li) => {
      let y = 0, el = li;
      while (el && el !== grid) { y += el.offsetTop; el = el.offsetParent; }
      return y + parseFloat(getComputedStyle(li).fontSize) * 0.5 + 4;
    };
    const xOf = (el) => { let x = 0; while (el && el !== grid) { x += el.offsetLeft; el = el.offsetParent; } return x; };
    points.forEach((p) => {
      p.y = yOf(p.li);
      p.edge = p.side < 0 ? p.panel.offsetLeft + p.panel.offsetWidth : p.panel.offsetLeft;
      // The bullet: 4px in from the li's aisle-side edge.
      const lx = xOf(p.li);
      p.bullet = p.side < 0 ? lx + p.li.offsetWidth - 4 : lx + 4;
    });
    // Wires land in reading order down the aisle, the two sides interleaved.
    points.sort((a, b) => a.y - b.y);
    geo.bottom = Math.max(...points.map((p) => p.y));

    spine = document.createElementNS(NS, 'path');
    spine.setAttribute('d', `M${geo.cx} ${geo.top} V${geo.bottom}`);
    spine.setAttribute('pathLength', '1');
    spine.setAttribute('class', 'aisle__spine');
    svg.append(spine);

    wires = []; ports = []; joints = [];
    points.forEach((p) => {
      const wire = document.createElementNS(NS, 'path');
      wire.setAttribute('d', `M${geo.cx} ${p.y.toFixed(1)} H${p.bullet.toFixed(1)}`);
      wire.setAttribute('pathLength', '1');
      wire.setAttribute('class', 'aisle__wire');
      const joint = document.createElementNS(NS, 'circle');
      joint.setAttribute('cx', geo.cx); joint.setAttribute('cy', p.y.toFixed(1)); joint.setAttribute('r', 3);
      joint.setAttribute('class', 'aisle__joint');
      const port = document.createElementNS(NS, 'circle');
      port.setAttribute('cx', p.edge.toFixed(1)); port.setAttribute('cy', p.y.toFixed(1)); port.setAttribute('r', 3.5);
      port.setAttribute('class', 'aisle__port');
      svg.append(wire, joint, port);
      wires.push(wire); joints.push(joint); ports.push(port);
    });

    pulses = points.map(() => {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('r', 2.6);
      c.setAttribute('class', 'aisle__pulse');
      svg.append(c);
      return c;
    });
    render();
  }

  // ---- the reveal, as a pure function of progress -------------------------
  const S = { p: motion ? 0 : 1 };
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const smooth = (v) => { const t = clamp01(v); return t * t * (3 - 2 * t); };

  function render() {
    const p = S.p;
    const wide = aisle.offsetWidth > 0;
    // 1 · the panels part from the centre line.
    const part = smooth(p / 0.3);
    if (wide && motion) {
      const shift = (aisle.offsetWidth / 2) * (1 - part);
      left.style.transform = `translateX(${shift.toFixed(1)}px)`;
      right.style.transform = `translateX(${(-shift).toFixed(1)}px)`;
      left.style.opacity = right.style.opacity = (0.2 + 0.8 * smooth(p / 0.18)).toFixed(3);
    }
    // 2 · TCC in the aisle, then the spine runs down.
    const nodeIn = smooth((p - 0.2) / 0.1);
    node.style.setProperty('--in', nodeIn.toFixed(3));
    const run = smooth((p - 0.26) / 0.3);
    spine?.style.setProperty('--draw', (1 - run).toFixed(3));
    const reach = geo.top + (geo.bottom - geo.top) * run;
    // 3 · a wire leaves once the spine has reached it, and lands to light
    //     its promise.
    points.forEach((pt, i) => {
      const start = pt.y <= reach + 0.5 ? 1 : 0;
      const f = start ? smooth((p - (0.3 + 0.5 * ((pt.y - geo.top) / Math.max(1, geo.bottom - geo.top)))) / 0.14) : 0;
      wires[i]?.style.setProperty('--draw', (1 - f).toFixed(3));
      joints[i]?.style.setProperty('--on', start ? '1' : '0');
      ports[i]?.style.setProperty('--on', f > 0.98 ? '1' : '0');
      pt.li.classList.toggle('is-lit', f > 0.98);
    });
    grid.classList.toggle('is-wired', p >= 0.999);
  }

  build();
  new ResizeObserver(() => build()).observe(grid);

  if (!motion) { points.forEach((p) => p.li.classList.add('is-lit')); return; }

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  const mm = gsap.matchMedia();

  mm.add('(min-width: 861px)', () => {
    const tween = gsap.to(S, {
      p: 1, ease: 'none', onUpdate: render,
      scrollTrigger: { trigger: grid, start: 'top 82%', end: 'center 45%', scrub: 0.6 },
    });
    return () => {
      tween.scrollTrigger?.kill(); tween.kill();
      left.style.transform = right.style.transform = left.style.opacity = right.style.opacity = '';
    };
  });

  mm.add('(max-width: 860px)', () => {
    S.p = 1; render();
    const triggers = points.map((pt) => ScrollTrigger.create({
      trigger: pt.li, start: 'top 62%',
      onToggle: (self) => pt.li.classList.toggle('is-lit', self.isActive || self.progress > 0),
    }));
    return () => triggers.forEach((t) => t.kill());
  });

  // 4 · current, out to both sides at once, while settled and on screen.
  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(grid);
  let t0 = performance.now();
  gsap.ticker.add(() => {
    const live = visible && !document.hidden && grid.classList.contains('is-wired');
    if (!live) { pulses.forEach((c) => c.style.setProperty('--on', '0')); t0 = performance.now(); return; }
    const t = ((performance.now() - t0) % PULSE_MS) / PULSE_MS;
    // Down the spine first (0–0.45), then out every wire together (0.45–1).
    const down = Math.min(1, t / 0.45);
    const y = geo.top + (geo.bottom - geo.top) * down;
    points.forEach((pt, i) => {
      const c = pulses[i];
      if (!c) return;
      if (y < pt.y) { c.style.setProperty('--on', '0'); return; }
      // Each wire's pulse leaves when the spine pulse passes its joint.
      const leave = (pt.y - geo.top) / Math.max(1, geo.bottom - geo.top) * 0.45;
      const f = Math.min(1, Math.max(0, (t - leave) / 0.5));
      const x = geo.cx + (pt.bullet - geo.cx) * (1 - (1 - f) ** 3); // ease-out
      c.setAttribute('cx', x.toFixed(1)); c.setAttribute('cy', pt.y.toFixed(1));
      c.style.setProperty('--on', f > 0 && f < 1 ? (1 - f * 0.6).toFixed(2) : '0');
    });
  });
}
