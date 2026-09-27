/**
 * Kinetic headlines — the letters arrive, not the lines.
 *
 * Each section already declares HOW it arrives (data-enter). The headline
 * now speaks the same direction at letter scale, so a section's title and
 * its copy enter as one gesture:
 *
 *   left / right   sweep  — letters slide in skewed, from the side the
 *                           section arrives from, first letter first
 *   lift           flip   — letters hinge up off their baseline in 3D
 *   settle         drop   — letters fall into place from the centre out
 *   rise           rise   — letters rise through the line mask
 *
 * The split is temporary. When the arrival ends, the heading's original
 * markup is put back exactly — so the cursor light, the focal-word gradient
 * and screen readers all meet the same DOM they always did. While split,
 * the heading carries an aria-label with its own text.
 *
 * A focal word is never split: it paints with background-clip:text, and
 * slicing it would clip each letter to its own box. It moves as one unit.
 */

export const VARIANTS = {
  left:   { from: { xPercent: -60, skewX: -14, opacity: 0 }, stagger: { each: 0.018, from: 'start' }, ease: 'expo.out', duration: 0.9 },
  right:  { from: { xPercent: 60, skewX: 14, opacity: 0 },   stagger: { each: 0.018, from: 'end' },   ease: 'expo.out', duration: 0.9 },
  lift:   { from: { rotationX: -88, yPercent: 30, opacity: 0, transformOrigin: '50% 100% -0.2em' }, stagger: { each: 0.02, from: 'start' }, ease: 'expo.out', duration: 1.0 },
  settle: { from: { yPercent: -70, opacity: 0 },              stagger: { each: 0.016, from: 'center' }, ease: 'power4.out', duration: 0.85 },
  rise:   { from: { yPercent: 110 },                          stagger: { each: 0.014, from: 'start' }, ease: 'expo.out', duration: 0.95 },
};

/** Split a heading's lines into letters. Returns the letters and a restore(). */
export function splitHeading(heading) {
  const lines = [...heading.querySelectorAll('.line > span')];
  if (!lines.length) return null;
  const original = lines.map((l) => l.innerHTML);
  const label = heading.textContent.replace(/\s+/g, ' ').trim();
  const chars = [];

  const splitText = (text, into) => {
    for (const part of text.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { into.append(' '); continue; }
      // Words never break mid-letter across lines.
      const word = document.createElement('span');
      word.className = 'kw';
      for (const ch of part) {
        const c = document.createElement('span');
        c.className = 'kc';
        c.textContent = ch;
        word.append(c);
        chars.push(c);
      }
      into.append(word);
    }
  };

  for (const line of lines) {
    const nodes = [...line.childNodes];
    line.textContent = '';
    for (const n of nodes) {
      if (n.nodeType === 3) splitText(n.textContent, line);
      else if (n.nodeType === 1 && n.classList.contains('focus-word')) {
        n.classList.add('kc', 'kc--unit');
        line.append(n);
        chars.push(n);
      } else if (n.nodeType === 1) {
        const clone = n.cloneNode(false);
        splitText(n.textContent, clone);
        line.append(clone);
      }
    }
  }
  heading.setAttribute('aria-label', label);
  heading.classList.add('is-kinetic');

  const restore = () => {
    lines.forEach((l, i) => { l.innerHTML = original[i]; });
    heading.removeAttribute('aria-label');
    heading.classList.remove('is-kinetic');
  };
  return { chars, restore };
}
