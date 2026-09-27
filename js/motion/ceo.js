import { motionEnabled } from './reveal.js';

/**
 * #ceo — in his words.
 *
 * Built as a live-caption moment, because the portrait is a man mid-talk
 * with a headset mic: the section should feel like hearing him, not like
 * reading a pull quote.
 *
 *   the portrait   opens as an iris out of the film's lens and settles out
 *                  of a slight push-in
 *   the name ring  his name and title orbit the portrait, slowly, only while
 *                  the section is on screen
 *   the voice ring 64 bars around the portrait move while he "speaks" — each
 *                  word lands as a pulse, pauses fall quiet, and when he is
 *                  done the ring settles to a slow breath
 *   the transcript the quote is transcribed word by word at a speaking pace
 *                  (longer words take longer, punctuation takes a breath);
 *                  "the head and the heart" lands as one phrase, in the
 *                  brand gradient — the page's own thesis, in his voice
 *   replay         once finished, it can be heard again
 *
 * It pauses when scrolled away and resumes where it was. The quote is fully
 * present in the DOM throughout — faint words are still words to a screen
 * reader. Motion off: the whole quote, still, and a quiet ring.
 */

const BARS = 64;
const R0 = 140;     // inner radius of the voice ring, viewBox units
const REST = 4;     // bar length at rest
const PEAK = 30;    // bar length at full voice

export function initCeo() {
  const section = document.getElementById('ceo');
  if (!section) return;
  const svg = section.querySelector('.ceo__rings');
  const voice = section.querySelector('.ceo__voice');
  const quote = section.querySelector('.ceo__quote p');
  const replay = section.querySelector('.ceo__replay');
  const portrait = section.querySelector('.ceo__portrait');

  // ---- the voice ring ---------------------------------------------------
  const NS = 'http://www.w3.org/2000/svg';
  const bars = Array.from({ length: BARS }, (_, i) => {
    const a = (i / BARS) * Math.PI * 2 - Math.PI / 2;
    const line = document.createElementNS(NS, 'line');
    line.dataset.cos = Math.cos(a); line.dataset.sin = Math.sin(a);
    voice.append(line);
    return { line, cos: Math.cos(a), sin: Math.sin(a), len: REST };
  });
  const drawBars = () => {
    for (const b of bars) {
      const r1 = R0 + b.len;
      b.line.setAttribute('x1', (200 + b.cos * R0).toFixed(1));
      b.line.setAttribute('y1', (200 + b.sin * R0).toFixed(1));
      b.line.setAttribute('x2', (200 + b.cos * r1).toFixed(1));
      b.line.setAttribute('y2', (200 + b.sin * r1).toFixed(1));
      b.line.style.opacity = (0.35 + 0.65 * Math.min(1, (b.len - REST) / (PEAK - REST) + 0.2)).toFixed(2);
    }
  };
  drawBars();

  if (!motionEnabled()) return;
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  // ---- the transcript ----------------------------------------------------
  // Words become spans; the key phrase (<mark>) stays one unit so its
  // gradient runs across the whole phrase.
  const words = [];
  const split = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const part of child.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.append(part); continue; }
          const s = document.createElement('span');
          s.className = 'ceo__w';
          s.textContent = part;
          frag.append(s);
          words.push(s);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === 1) {
        child.classList.add('ceo__w');
        words.push(child);
      }
    }
  };
  split(quote);

  // Speaking pace: a beat per word plus a little per letter, and a breath
  // at punctuation.
  const beat = (w) => {
    const t = w.textContent;
    let ms = 30 + t.length * 11;
    if (/[.”]$/.test(t)) ms += 220; else if (/[,;]$/.test(t)) ms += 110;
    if (w.tagName === 'MARK') ms += 160;
    return ms;
  };

  let i = 0, timer = 0, visible = false, done = false, started = false;
  let energy = 0; // 0..1, the voice's loudness right now; decays between words

  function say() {
    clearTimeout(timer);
    if (!visible || document.hidden) return;
    if (i >= words.length) { finish(); return; }
    section.classList.add('is-speaking');
    words.forEach((w, j) => w.classList.toggle('is-now', j === i));
    words[i].classList.add('is-said');
    energy = words[i].tagName === 'MARK' ? 1 : 0.55 + Math.min(0.45, words[i].textContent.length / 18);
    const wait = beat(words[i]);
    i++;
    timer = setTimeout(say, wait);
  }
  function finish() {
    done = true;
    section.classList.remove('is-speaking');
    words.forEach((w) => w.classList.remove('is-now'));
    replay.hidden = false;
  }
  function restart() {
    done = false; i = 0;
    replay.hidden = true;
    words.forEach((w) => w.classList.remove('is-said', 'is-now'));
    setTimeout(say, 350);
  }
  replay.addEventListener('click', restart);

  // ---- the ring, driven by the voice ---------------------------------------
  let t = 0;
  gsap.ticker.add((_time, dt) => {
    if (!visible) return;
    t += dt / 1000;
    energy *= Math.exp(-dt / 180); // each word is a pulse that fades
    const speaking = section.classList.contains('is-speaking');
    for (let k = 0; k < BARS; k++) {
      const b = bars[k];
      // Two travelling waves around the ring, so it reads as sound, not noise.
      const wave = 0.5 + 0.5 * Math.sin(k * 0.55 + t * 7) * Math.sin(k * 0.17 - t * 3.1);
      const target = speaking
        ? REST + (PEAK - REST) * energy * (0.35 + 0.65 * wave)
        : REST + 3 * (0.5 + 0.5 * Math.sin(t * 1.4 + k * 0.2)); // a slow breath
      b.len += (target - b.len) * (1 - Math.exp(-dt / 60));
    }
    drawBars();
  });

  // ---- arrival and visibility -------------------------------------------------
  gsap.fromTo(portrait, { '--iris': '0%', '--push': 1.18 }, {
    '--iris': '50%', '--push': 1, duration: 1.4, ease: 'expo.out',
    scrollTrigger: { trigger: section, start: 'top 75%', once: true },
  });

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    section.classList.toggle('is-visible', visible);
    if (!visible) { clearTimeout(timer); section.classList.remove('is-speaking'); return; }
    if (done) return;
    // A first beat of silence after the portrait opens, then he speaks.
    if (!started) { started = true; timer = setTimeout(say, 900); } else say();
  }, { threshold: 0.45 }).observe(section);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible && !done) say(); });

  svg.dataset.ready = '1';
}
