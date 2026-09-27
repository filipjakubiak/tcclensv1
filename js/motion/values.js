import { motionEnabled } from './reveal.js';

/**
 * #careers — the four values as a story you can play.
 *
 * The values were a 2x2 block of copy. They are four things people at TCC
 * hold each other to, so they now arrive one at a time, big, in a format
 * everyone already knows how to read: story segments.
 *
 *   the word    each value rolls in letter by letter — the old word lifts
 *               out through the top of its mask as the new one rises in
 *   the line    the value's sentence crossfades under it (blur-bridged)
 *   segments    four tabs with progress lines; the active one fills over
 *               the dwell time, then the next value plays. Click or arrow
 *               keys jump; hovering or focusing the block holds it
 *   the photo   the picture beside it re-frames for each value — a slow
 *               pan and push, so the image listens to the words
 *
 * Built FROM the existing list, which stays in the page as the fallback:
 * no JS, reduced motion or ?shot=1 all get the plain four-value list.
 * Autoplay runs only while the block is on screen and the tab is visible.
 */

const DWELL = 3400;
// One framing per value — scale and offset of the picture inside its card.
// Offsets stay inside the scale's overhang, so the frame is never exposed.
const FRAMES = [
  { scale: 1.0, xPercent: 0, yPercent: 0 },
  { scale: 1.16, xPercent: -5, yPercent: 2 },
  { scale: 1.12, xPercent: 4, yPercent: -3 },
  { scale: 1.2, xPercent: 0, yPercent: -5 },
];

export function initValues() {
  const list = document.querySelector('.careers__values');
  if (!list || !motionEnabled()) return;
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  const items = [...list.querySelectorAll('.value')].map((li) => ({
    name: li.querySelector('h3').textContent.trim(),
    line: li.querySelector('p').textContent.trim(),
  }));
  if (items.length < 2) return;
  const picture = document.querySelector('.careers__img picture');

  // ---- build ------------------------------------------------------------
  const root = document.createElement('div');
  root.className = 'values';
  root.innerHTML = `
    <div class="values__stage" role="tabpanel" id="values-panel" aria-labelledby="values-tab-0">
      <span class="values__index" aria-hidden="true"></span>
      <p class="values__word" aria-hidden="true"><span class="values__letters"></span><span class="values__dot">.</span></p>
      <p class="values__line"></p>
    </div>
    <div class="values__tabs" role="tablist" aria-label="Our values">
      ${items.map((it, i) => `
        <button class="values__tab" role="tab" type="button" id="values-tab-${i}" aria-controls="values-panel"
          aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">
          <span class="values__name">${it.name}</span><span class="values__bar"><i></i></span>
        </button>`).join('')}
    </div>`;
  list.after(root);
  list.classList.add('is-replaced');

  const stage = root.querySelector('.values__stage');
  const lettersEl = root.querySelector('.values__letters');
  const lineEl = root.querySelector('.values__line');
  const indexEl = root.querySelector('.values__index');
  const tabs = [...root.querySelectorAll('.values__tab')];
  let active = -1, timer = 0, bar = null, visible = false, held = false;

  const setLetters = (word) => {
    lettersEl.textContent = '';
    return [...word].map((ch) => {
      const s = document.createElement('span');
      s.className = 'values__l';
      s.textContent = ch;
      lettersEl.append(s);
      return s;
    });
  };

  // ---- show a value -------------------------------------------------------
  function show(i, { focus = false } = {}) {
    if (i === active) return;
    const first = active < 0;
    active = i;
    const it = items[i];

    tabs.forEach((t, j) => {
      t.setAttribute('aria-selected', j === i ? 'true' : 'false');
      t.tabIndex = j === i ? 0 : -1;
      t.classList.toggle('is-done', j < i);
    });
    stage.setAttribute('aria-labelledby', `values-tab-${i}`);
    if (focus) tabs[i].focus();
    indexEl.textContent = `${String(i + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;

    // The word: old letters lift out through the top, new ones rise in.
    const old = [...lettersEl.children];
    const swapIn = () => {
      const fresh = setLetters(it.name);
      gsap.fromTo(fresh,
        { yPercent: 110, rotationX: -70, opacity: 0, transformPerspective: 600, transformOrigin: '50% 100%' },
        { yPercent: 0, rotationX: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.035 });
    };
    if (old.length && !first) {
      gsap.to(old, {
        yPercent: -110, rotationX: 70, opacity: 0, filter: 'blur(3px)',
        duration: 0.35, ease: 'power2.in', stagger: 0.02, onComplete: swapIn,
      });
    } else swapIn();

    // The line: blur bridges the crossfade into one line changing.
    lineEl.classList.add('is-swapping');
    setTimeout(() => { lineEl.textContent = it.line; lineEl.classList.remove('is-swapping'); }, first ? 0 : 220);

    // The photo re-frames.
    if (picture) gsap.to(picture, { ...FRAMES[i % FRAMES.length], duration: 1.4, ease: 'power2.inOut', overwrite: true });

    schedule();
  }

  // ---- autoplay (segments) ------------------------------------------------------
  function schedule() {
    clearTimeout(timer);
    bar?.kill();
    if (active < 0) return; // nothing shown yet — the first reach will start it
    tabs.forEach((t, j) => {
      const fill = t.querySelector('.values__bar i');
      gsap.set(fill, { scaleX: j < active ? 1 : 0 });
    });
    const playing = visible && !held && !document.hidden;
    root.classList.toggle('is-playing', playing);
    if (!playing) {
      gsap.set(tabs[active].querySelector('.values__bar i'), { scaleX: 1 });
      return;
    }
    // Linear: the segment is time.
    bar = gsap.fromTo(tabs[active].querySelector('.values__bar i'), { scaleX: 0 }, { scaleX: 1, duration: DWELL / 1000, ease: 'none' });
    timer = setTimeout(() => show((active + 1) % items.length), DWELL);
  }

  // ---- inputs -----------------------------------------------------------------
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(i));
    t.addEventListener('keydown', (e) => {
      const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (k) { e.preventDefault(); show((active + k + items.length) % items.length, { focus: true }); }
      if (e.key === 'Home') { e.preventDefault(); show(0, { focus: true }); }
      if (e.key === 'End') { e.preventDefault(); show(items.length - 1, { focus: true }); }
    });
  });
  const hold = (on) => { held = on; schedule(); };
  root.addEventListener('pointerenter', () => hold(true));
  root.addEventListener('pointerleave', () => hold(false));
  root.addEventListener('focusin', () => hold(true));
  root.addEventListener('focusout', (e) => { if (!root.contains(e.relatedTarget)) hold(false); });
  document.addEventListener('visibilitychange', schedule);

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && active < 0) show(0); else schedule();
  }, { threshold: 0.35 }).observe(root);

  // First paint before it is reached: the first value, still.
  lettersEl.textContent = items[0].name;
  lineEl.textContent = items[0].line;
  indexEl.textContent = `01 / ${String(items.length).padStart(2, '0')}`;
}
