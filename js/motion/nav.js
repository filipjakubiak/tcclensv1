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
  // first-link focus has to wait for `transitionend`, not fire inline.
  const focusFirstLink = () => menu.querySelector('a')?.focus();

  const setOpen = (open) => {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    menu.removeEventListener('transitionend', focusFirstLink);
    if (open) {
      menu.addEventListener('transitionend', focusFirstLink, { once: true });
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
