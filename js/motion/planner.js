/**
 * #contact — "Build your programme".
 *
 * The page's last scene recaps the reel: pick which side of the aisle you
 * are on and what you want to grow, and the capabilities from the showreel
 * that fit light up — the toolkit, filtered to you — above the one button
 * that starts the conversation.
 *
 * The goals are the page's own promises (the fork panels' three per side),
 * so nothing here says more than the page already does. It is real UI, not
 * motion, so it works with reduced motion too; only the transitions are
 * gated (in CSS).
 */

// Which capabilities answer which goal.
const MAP = {
  visits: ['quest', 'games'],
  baskets: ['quest', 'world'],
  lasting: ['world', 'mobile'],
  placement: ['mobile', 'games'],
  engagement: ['games', 'quest'],
  goodwill: ['community', 'mobile'],
};
const WHO = { retailer: 'retailers', brand: 'brands' };

export function initPlanner() {
  const root = document.querySelector('.planner');
  if (!root) return;
  const opts = [...root.querySelectorAll('.planner__opt')];
  const groups = [...root.querySelectorAll('.planner__chips')];
  const caps = [...root.querySelectorAll('.planner__cap')];
  const summary = root.querySelector('.planner__summary');
  let who = 'retailer';

  const chipsOf = (w) => [...root.querySelector(`.planner__chips[data-for="${w}"]`).querySelectorAll('.planner__chip')];

  function render() {
    const picked = chipsOf(who).filter((c) => c.getAttribute('aria-pressed') === 'true');
    const on = new Set(picked.flatMap((c) => MAP[c.dataset.goal] ?? []));
    // Light the fitting capabilities in list order, a beat apart.
    let n = 0;
    caps.forEach((cap) => {
      const lit = on.has(cap.dataset.cap);
      cap.style.setProperty('--order', lit ? n++ : 0);
      cap.classList.toggle('is-in', lit);
    });
    const goals = picked.map((c) => c.textContent.trim().toLowerCase());
    const list = goals.length > 1 ? `${goals.slice(0, -1).join(', ')} and ${goals.at(-1)}` : goals[0];
    summary.textContent = `For ${WHO[who]} who want ${list}.`;
  }

  opts.forEach((o) => o.addEventListener('click', () => {
    who = o.dataset.who;
    opts.forEach((x) => x.setAttribute('aria-checked', x === o ? 'true' : 'false'));
    root.dataset.who = who;
    groups.forEach((g) => { g.hidden = g.dataset.for !== who; });
    render();
  }));
  // Radio-group keys: arrows move the choice.
  root.querySelector('.planner__seg').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const next = opts.find((o) => o.getAttribute('aria-checked') !== 'true');
    next.click(); next.focus();
  });

  groups.forEach((g) => g.querySelectorAll('.planner__chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const on = chip.getAttribute('aria-pressed') === 'true';
      const count = [...g.querySelectorAll('[aria-pressed="true"]')].length;
      // A programme always has at least one goal.
      if (on && count === 1) {
        chip.classList.remove('is-refused'); void chip.offsetWidth; chip.classList.add('is-refused');
        return;
      }
      chip.setAttribute('aria-pressed', on ? 'false' : 'true');
      render();
    });
  }));

  root.dataset.who = who;
  render();
}
