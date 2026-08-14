export function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  const sync = () => {
    nav.classList.toggle('nav--solid', window.scrollY > window.innerHeight * 0.85);
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
}
