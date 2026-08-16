export function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  const progress = nav.querySelector('.nav__progress');

  const sync = () => {
    nav.classList.toggle('nav--solid', window.scrollY > window.innerHeight * 0.85);
    if (progress) {
      // Plain scroll maths, not GSAP: this is an orientation cue and has to
      // keep working with motion off, under reduced motion and in ?shot=1,
      // where the ScrollTrigger machinery is never started.
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const read = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
      progress.style.setProperty('--read', read.toFixed(4));
    }
  };
  sync();
  window.addEventListener('scroll', sync, { passive: true });

  const menu = document.querySelector('.menu');
  const burger = document.querySelector('.nav__burger');
  if (!menu || !burger) return;

  // The menu's hidden state relies on a CSS `visibility` transition (never
  // display:none, so the focus trap keeps working). Chromium won't accept
  // focus on an element while it's still computed as visibility:hidden,
  // and that stays true until the transition actually finishes — so the
  // first-link focus prefers to wait for `transitionend`. But that must
  // not be a hard dependency: prefers-reduced-motion (Task 8 sets
  // `transition: none` for it) or any future change that drops the
  // transition would mean `transitionend` never fires, silently breaking
  // focus management. A bounded fallback timer races it — whichever
  // happens first wins, and the timer alone still guarantees focus lands
  // even if no transition ever runs. Timer must exceed --dur-ui (240ms).
  const focusFirstLink = () => menu.querySelector('a')?.focus();

  let cancelFocusFallback = () => {};

  const setOpen = (open) => {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    cancelFocusFallback();
    if (open) {
      let done = false;
      const once = () => {
        if (done) return;
        done = true;
        focusFirstLink();
      };
      menu.addEventListener('transitionend', once, { once: true });
      const timer = setTimeout(once, 400);
      cancelFocusFallback = () => {
        done = true;
        clearTimeout(timer);
        menu.removeEventListener('transitionend', once);
      };
    } else {
      burger.focus();
    }
  };

  burger.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) setOpen(false);
  });

  // Simple focus trap: keep Tab cycling within the menu while it is open.
  menu.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !menu.classList.contains('is-open')) return;
    const focusable = menu.querySelectorAll('a, button');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // Close the menu when a link inside it is followed.
  menu.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => setOpen(false))
  );

  initMenuIllumination(menu);
}

/**
 * Light each menu link with the gradient of the section it opens.
 *
 * The hover, focus and press states are CSS. What needs JS is the two things
 * CSS cannot know: WHICH gradient belongs to a link, and which section the
 * reader is currently in.
 *
 * Deliberately an IntersectionObserver rather than a ScrollTrigger — this is
 * an orientation cue, not choreography, so it has to keep working with motion
 * off, under prefers-reduced-motion and under ?shot=1, where GSAP's scroll
 * machinery is never started.
 */
function initMenuIllumination(menu) {
  const links = [...menu.querySelectorAll('.menu__link[href^="#"]')];
  if (!links.length) return;

  const targets = new Map();
  for (const link of links) {
    const section = document.querySelector(link.getAttribute('href'));
    if (!section) continue;
    // Read the gradient off the section itself rather than repeating the
    // assignment in the markup, so the menu cannot drift out of step with
    // the page. Untinted sections fall through to the core gradient the CSS
    // already sets.
    const grad = section.dataset.tint;
    if (grad && grad !== 'core') link.dataset.grad = grad;
    targets.set(section, link);
  }
  if (!targets.size) return;

  // Nearest section to the top of the viewport wins, so exactly one link is
  // ever current — with several sections on screen at once, marking each
  // intersecting one would light half the menu.
  const visible = new Set();
  const sync = () => {
    let best = null;
    let bestTop = Infinity;
    for (const section of visible) {
      const top = Math.abs(section.getBoundingClientRect().top);
      if (top < bestTop) { bestTop = top; best = section; }
    }
    for (const [section, link] of targets) {
      if (section === best) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
  };

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) visible.add(e.target);
      else visible.delete(e.target);
    }
    sync();
  }, { threshold: 0.15 });

  for (const section of targets.keys()) io.observe(section);
}
