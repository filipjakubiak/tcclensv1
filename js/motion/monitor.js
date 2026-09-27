import { motionEnabled } from './reveal.js';

/**
 * #loyalty-monitor — the gauge.
 *
 * The section's argument is a distance: 57% say they're loyal, 76% would
 * switch. So the scroll tells it as a race that splits:
 *
 *   0.00–0.45  the bar fills to 57 and BOTH figures climb together
 *   0.45–0.80  76 pulls away — the hatched gap opens from 57 to 76 while
 *              only the second figure keeps counting
 *   0.80–1.00  the markers land, leader lines tie each figure to its mark,
 *              and the bracket names the distance
 *   settled    the hatching drifts: the gap is live, not a still
 *
 * Scrubbed and reversible, the figures included — they are part of the
 * measurement, not a one-off flourish. Motion off: the finished gauge.
 */
export function initMonitor() {
  const gauge = document.querySelector('.gauge');
  if (!gauge) return;
  // The visible counter animates; the real figure stays in the accessibility
  // tree, so a screen reader never hears the parked "0%".
  const numA = gauge.querySelector('.monitor__state--a .monitor__count');
  const numB = gauge.querySelector('.monitor__state--b .monitor__count');
  const fill = gauge.querySelector('.monitor__fill');
  const gap = gauge.querySelector('.monitor__gap');
  const [mA, mB] = gauge.querySelectorAll('.gauge__marker');
  const bracket = gauge.querySelector('.gauge__bracket');
  const svg = gauge.querySelector('.gauge__leaders');
  const [lA, lB] = svg.querySelectorAll('.gauge__leader');
  const track = gauge.querySelector('.monitor__meter');

  // Leader lines from the foot of each figure to where it lands on the bar.
  const layout = () => {
    const g = svg.getBoundingClientRect();
    const t = track.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${g.width} ${g.height}`);
    const foot = (num) => { const r = num.getBoundingClientRect(); return r.left + r.width / 2 - g.left; };
    const at = (pct) => t.left - g.left + t.width * pct;
    lA.setAttribute('d', `M${foot(numA)} 0 C${foot(numA)} ${g.height * 0.6} ${at(0.57)} ${g.height * 0.4} ${at(0.57)} ${g.height}`);
    lB.setAttribute('d', `M${foot(numB)} 0 C${foot(numB)} ${g.height * 0.6} ${at(0.76)} ${g.height * 0.4} ${at(0.76)} ${g.height}`);
  };
  layout();
  new ResizeObserver(layout).observe(gauge);

  if (!motionEnabled()) return;

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const smooth = (v) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
  const S = { p: 0 };

  function render() {
    const p = S.p;
    const a = smooth(p / 0.45);
    const b = smooth((p - 0.45) / 0.35);
    fill.style.setProperty('--fill', a.toFixed(4));
    gap.style.setProperty('--gap', b.toFixed(4));
    numA.textContent = `${Math.round(57 * a)}%`;
    numB.textContent = `${Math.round(57 * a + 19 * b)}%`;
    mA.style.setProperty('--m', smooth((p - 0.4) / 0.08).toFixed(3));
    mB.style.setProperty('--m', smooth((p - 0.78) / 0.08).toFixed(3));
    const br = smooth((p - 0.82) / 0.14);
    bracket.style.setProperty('--br', br.toFixed(3));
    lA.style.opacity = smooth((p - 0.45) / 0.15).toFixed(3);
    lB.style.opacity = smooth((p - 0.82) / 0.15).toFixed(3);
    gauge.classList.toggle('is-live', p >= 0.999);
  }

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  gsap.to(S, {
    p: 1, ease: 'none', onUpdate: render,
    scrollTrigger: { trigger: gauge, start: 'top 85%', end: 'bottom 70%', scrub: 0.6 },
  });
  render();
}
