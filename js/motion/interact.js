import { motionEnabled } from './reveal.js';

/**
 * Interactivity: the places the page answers the reader rather than the
 * scrollbar.
 *
 * Everything here is gated on a fine pointer AND on motionEnabled(), so a
 * touch device, a reduced-motion preference and ?shot=1 all get the settled
 * page with no handlers attached at all.
 */

const finePointer = () =>
  window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * The glass mark leans toward the cursor.
 *
 * The centrepiece of the whole page ignored the reader completely: it moved
 * for the scrollbar and for nothing else. This is the smallest change that
 * makes it feel like an object in the room rather than a rendered video.
 *
 * Written to lens.pointer, the group ABOVE the one acts drive. Acts assign to
 * lens.group every frame, so a rotation written there would be gone by the
 * next update — the same trap that has wiped a fit scale and a recentring
 * offset in this codebase before.
 *
 * Eased toward the target rather than set from it. Tying a transform straight
 * to pointer position reads as mechanical; the lag is what makes it feel like
 * mass.
 */
export function initMarkPointer(lens) {
  if (!motionEnabled() || !finePointer() || !lens?.pointer) return;

  const MAX_Y = 0.16; // rad, about 9deg
  const MAX_X = 0.10;
  let tx = 0, ty = 0;

  window.addEventListener('pointermove', (e) => {
    // -1..1 across the viewport, so the lean is about where the pointer is on
    // screen rather than where it is relative to the mark — the mark moves
    // around during the scroll and a mark-relative origin would make the
    // response jump every time an act repositioned it.
    tx = (e.clientY / window.innerHeight) * 2 - 1;
    ty = (e.clientX / window.innerWidth) * 2 - 1;
  }, { passive: true });

  // Runs on the stage clock, which already pauses when the tab is hidden.
  return () => {
    const p = lens.pointer;
    p.rotation.y += (ty * MAX_Y - p.rotation.y) * 0.045;
    p.rotation.x += (tx * MAX_X - p.rotation.x) * 0.045;
  };
}

/**
 * The client marquee slows under the pointer.
 *
 * A band of logos scrolling past at a fixed speed is the one element on the
 * page that actively resists being read. Slowing rather than stopping keeps
 * it alive while giving the reader a chance to actually look at a logo.
 */
export function initMarquee() {
  if (!motionEnabled() || !finePointer()) return;
  const marquee = document.querySelector('.marquee');
  if (!marquee) return;

  marquee.addEventListener('pointerenter', () => marquee.classList.add('is-slowed'));
  marquee.addEventListener('pointerleave', () => marquee.classList.remove('is-slowed'));
}

/**
 * The offices list answers the pointer, and the keyboard.
 *
 * Twenty offices is the section's claim and the list was inert once it had
 * drawn itself in. Hovering a city lifts its rule and its meta; the rows are
 * focusable so the same thing happens on Tab, which is the part hover-only
 * effects usually miss.
 */
export function initOfficeRows() {
  const rows = document.querySelectorAll('.global__offices li');
  if (!rows.length) return;
  for (const row of rows) {
    // Focusable so the hover state is reachable without a mouse. Not a
    // button: these are not actions, they are data the reader can dwell on.
    row.setAttribute('tabindex', '0');
  }
}
