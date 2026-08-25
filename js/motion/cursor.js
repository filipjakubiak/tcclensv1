import { motionEnabled } from './reveal.js';

export function initCursor() {
  if (!motionEnabled()) return;
  if (!window.matchMedia('(pointer: fine)').matches) return;

  const dot = document.createElement('div');
  dot.className = 'cursor';
  dot.setAttribute('aria-hidden', 'true');
  document.body.appendChild(dot);

  // Hide the SYSTEM cursor, and only once the dot is actually on the page.
  // Set here rather than in the stylesheet on purpose: every early return
  // above (touch device, reduced motion, ?shot=1) means there is no dot, and
  // a CSS-only `cursor: none` would leave those readers with no pointer at
  // all. The class is the proof that a replacement exists.
  document.documentElement.classList.add('cursor-live');

  // ONE owner of this element's transform, and it is this loop.
  //
  // What was here: gsap.quickTo wrote an inline `transform` every frame
  // while `.cursor { transition: transform 240ms }` re-interpolated each of
  // those per-frame writes over another 240ms. Two smoothers in series is
  // the reported lag — measured, the dot took 768ms to arrive after the
  // pointer had already stopped. The same inline transform also outranked
  // `.cursor--swell { transform: scale(3.667) }`, so the link swell had
  // never rendered once since it was written (measured scale 1.000).
  //
  // Both failures had one cause: two owners of one `transform`. Composing
  // translate and scale into a single string written from a single place
  // makes them unrepresentable rather than merely fixed — the same rule the
  // magnetic buttons and the surface kit already arrived at, by this route.
  //
  // GSAP is gone from the dot entirely. A tween per axis buys nothing here:
  // this is one element chasing one point, and a bare rAF costs one style
  // write per frame with no tween bookkeeping behind it.
  let px = 0, py = 0;         // where the dot is drawn
  let tx = 0, ty = 0;         // where the pointer is
  let placed = false;
  let raf = 0;
  let last = 0;

  // Catch-up fraction per 60Hz frame, rescaled by real dt below so the dot
  // feels identical on a 60Hz panel and a 144Hz one. Framerate-dependent
  // lerps are why "smooth here, laggy there" bugs are so hard to pin down.
  const CHASE = 0.3;

  // POSITION ONLY. There is no scale term here and there must not be one:
  // the swell is a size change in CSS, because a 12px circle stretched to
  // 44px has no detail to stretch and came out soft and stair-stepped. The
  // trailing translate(-50%, -50%) centres the dot on the pointer whatever
  // size it currently is, which is what frees the size to animate at all.
  const write = () => {
    dot.style.transform =
      `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, 0) translate(-50%, -50%)`;
  };

  const draw = (now) => {
    const dt = last ? Math.min((now - last) / 16.667, 4) : 1;
    last = now;
    px += (tx - px) * (1 - (1 - CHASE) ** dt);
    py += (ty - py) * (1 - (1 - CHASE) ** dt);
    write();

    // Park once it has arrived. An idle pointer should not hold a rAF open
    // for the life of the page — the stage clock is already running one.
    if (Math.abs(tx - px) > 0.05 || Math.abs(ty - py) > 0.05) {
      raf = requestAnimationFrame(draw);
    } else {
      px = tx; py = ty;
      write();
      raf = 0; last = 0;
    }
  };

  const wake = () => { if (!raf) { last = 0; raf = requestAnimationFrame(draw); } };

  // First sighting SNAPS, and reveals. Easing in from 0,0 flies the dot
  // diagonally across the page the first time the reader touches the mouse,
  // and until then it is a stray dot parked in the corner.
  //
  // Bound to pointerdown and pointerover as well as pointermove, because
  // `cursor: none` is already in force by this line: a reader whose pointer
  // is over the page but has not MOVED — a trackpad tap, a stylus, a mouse
  // that has not been touched since load — would otherwise have no pointer
  // on screen at all. Any pointer event is enough to know where they are.
  const see = (e) => {
    tx = e.clientX; ty = e.clientY;
    if (!placed) {
      placed = true;
      px = tx; py = ty;
      write();
      dot.classList.add('is-placed');
    }
    wake();
  };

  window.addEventListener('pointermove', see, { passive: true });
  window.addEventListener('pointerdown', see, { passive: true });
  window.addEventListener('pointerover', see, { passive: true });

  // Delegated, not two listeners on each of the page's ~90 links and buttons.
  // Fewer handlers to run per pointer event is the point; that it also covers
  // anything added to the DOM later is a bonus this page does not need yet.
  // The swell is a class, and CSS transitions the dot's WIDTH AND HEIGHT.
  // Not a transform: see the note above and the one in main.css.
  const SWELLS = 'a, button, [data-magnetic]';
  document.addEventListener('pointerover', (e) => {
    if (e.target.closest?.(SWELLS)) dot.classList.add('is-swollen');
  }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    // pointerout also fires moving BETWEEN two children of the same link, so
    // only reset when the pointer has actually left everything swellable.
    if (e.target.closest?.(SWELLS) && !e.relatedTarget?.closest?.(SWELLS)) {
      dot.classList.remove('is-swollen');
    }
  }, { passive: true });
}

export function initMagnetic() {
  if (!motionEnabled()) return;
  if (!window.matchMedia('(pointer: fine)').matches) return;
  const { gsap } = window;
  const MAX = 8;

  // Animates CUSTOM PROPERTIES, not x/y.
  //
  // GSAP's x/y write an inline `transform`, and an inline style outranks any
  // stylesheet rule — so `.btn:active { transform: scale(.97) }` stopped
  // applying to every magnetic element the moment this ran. That is the nav
  // CONTACT button, both hero CTAs, the monitor CTA, the careers link and the
  // closing CTA: essentially every primary button on the page had no press
  // feedback, and nothing failed to make it visible.
  //
  // Composing both through variables inside one CSS transform is the same
  // rule the surface kit follows for entrance vs tilt, arrived at the same
  // way — two owners of one property means whichever wrote last wins.
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    // The rect is read on ENTER and on resize, never inside pointermove.
    // getBoundingClientRect() forces a synchronous layout, and pointermove
    // fires at the mouse's polling rate — 125Hz on an office mouse, up to
    // 1000Hz on a gaming one — so reading it per event made the reader's own
    // hand the most expensive thing on the page. Magnetic elements are
    // buttons and links: they do not move or resize while being hovered.
    let r = null;
    let raf = 0;
    let ex = 0, ey = 0;

    const apply = () => {
      raf = 0;
      if (!r) return;
      const dx = ((ex - (r.left + r.width / 2)) / (r.width / 2)) * MAX;
      const dy = ((ey - (r.top + r.height / 2)) / (r.height / 2)) * MAX;
      gsap.to(el, {
        '--mag-x': `${dx.toFixed(2)}px`, '--mag-y': `${dy.toFixed(2)}px`,
        duration: 0.4, ease: 'power3.out',
      });
    };

    el.addEventListener('pointerenter', () => { r = el.getBoundingClientRect(); }, { passive: true });

    el.addEventListener('pointermove', (e) => {
      ex = e.clientX; ey = e.clientY;
      if (!r) r = el.getBoundingClientRect();
      // At most ONE tween per frame. This built a fresh gsap.to() per event,
      // so a fast sweep across the nav allocated tweens far faster than they
      // could ever render — all but the last of them overwritten unseen.
      if (!raf) raf = requestAnimationFrame(apply);
    }, { passive: true });

    el.addEventListener('pointerleave', () => {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      r = null;
      // power3.out, NOT elastic. The spec's motion system forbids "Bounce.
      // Elastic." by name, and this had carried elastic.out(1, 0.6) since it
      // was written — the one place on the page that overshot.
      gsap.to(el, {
        '--mag-x': '0px', '--mag-y': '0px',
        duration: 0.5, ease: 'power3.out', overwrite: true,
      });
    }, { passive: true });
  });
}
