import { motionEnabled } from './reveal.js';

/**
 * #global's two figures — 20 offices, 300 people — shown once, as the
 * section's main moment.
 *
 * Each digit is an odometer wheel: a column of digits that spins up from 0
 * and stops on its own figure. Wheels further right spin more turns and stop
 * later, like a real counter settling. The labels then rise through their
 * masks beside the figures.
 *
 * The heading carries an aria-label with its own words; the wheels are
 * aria-hidden, so assistive tech reads "20 offices worldwide 300 people…",
 * not a column of digits.
 *
 * Motion off (reduced motion, ?shot=1): nothing is built; the figures are the
 * plain text in the markup.
 */
export function initGlobalStats() {
  const stats = document.querySelector('#global .global__stats');
  if (!stats || !motionEnabled()) return;
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  stats.setAttribute('aria-label', stats.textContent.replace(/\s+/g, ' ').trim());
  const wheels = [];
  stats.querySelectorAll('[data-roll]').forEach((num, n) => {
    const digits = [...num.textContent.trim()];
    num.textContent = '';
    num.setAttribute('aria-hidden', 'true');
    digits.forEach((d, i) => {
      const target = Number(d);
      const turns = 1 + i + n; // the rightmost wheel of the larger figure spins most
      const wheel = document.createElement('span');
      wheel.className = 'gstat__wheel';
      const strip = document.createElement('span');
      strip.className = 'gstat__strip';
      const count = turns * 10 + target + 1;
      for (let k = 0; k < count; k++) {
        const cell = document.createElement('span');
        cell.textContent = k % 10;
        strip.append(cell);
      }
      wheel.append(strip);
      num.append(wheel);
      wheels.push({ strip, count, order: n * 0.25 + i * 0.12 });
    });
  });
  // Each cell is 1em tall; the window crops it to the digits' own ink, so
  // the wheel reads as one digit, not a column. Measured from the live font,
  // with a hair of room for the overshoot of round digits.
  const fit = () => {
    const cs = getComputedStyle(stats.querySelector('.gstat__num'));
    const px = parseFloat(cs.fontSize);
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${cs.fontWeight} ${px}px ${cs.fontFamily}`;
    const m = ctx.measureText('0123456789');
    const ink = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    const box = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
    const baseline = (px - box) / 2 + m.fontBoundingBoxAscent; // in a line-height:1 cell
    const top = baseline - m.actualBoundingBoxAscent;
    stats.style.setProperty('--gt', `${(top / px - 0.03).toFixed(3)}em`);
    stats.style.setProperty('--gh', `${(ink / px + 0.06).toFixed(3)}em`);
  };
  fit();
  document.fonts?.ready.then(fit);
  const labels = stats.querySelectorAll('.gstat__label > span');

  const tl = gsap.timeline({
    paused: true,
    onComplete: () => { stats.dataset.rolled = '1'; }, // for tests
  });
  wheels.forEach((w) => {
    tl.fromTo(w.strip, { yPercent: 0 }, {
      yPercent: -100 * (w.count - 1) / w.count,
      duration: 1.9 + w.order, ease: 'expo.inOut',
    }, w.order);
  });
  // y: 0 too — GSAP reads the CSS pre-state (translateY(110%)) as pixels.
  tl.fromTo(labels, { y: 0, yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: 'expo.out', stagger: 0.15 }, 1.2);

  ScrollTrigger.create({ trigger: stats, start: 'top 82%', once: true, onEnter: () => tl.play() });
}
