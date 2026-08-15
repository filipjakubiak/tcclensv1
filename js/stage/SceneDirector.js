/**
 * The act director.
 *
 * One page-level ScrollTrigger produces a single global progress 0→1. The
 * director owns the map from that number to "which act, and how far into
 * it", and nothing else — acts themselves own all geometry and transforms.
 *
 * This ships before any act content on purpose: the spec names four-act
 * camera choreography as the highest-severity risk in the build, so the
 * instrument for tuning it has to exist before there is anything to tune.
 */

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function createDirector(stage, ctx) {
  const acts = [];
  let progress = 0;
  let active = null;

  const director = {
    get progress() { return progress; },
    get activeAct() { return active; },
    get acts() { return acts; },
    register, setProgress, attachScroll,
  };

  function register(act) {
    act._t = 0;
    act.build?.(ctx);
    acts.push(act);
    acts.sort((a, b) => a.range[0] - b.range[0]);
    return director;
  }

  function actAt(p) {
    // Last act whose start <= p; the final act owns p === 1.
    let found = acts[0];
    for (const a of acts) if (p >= a.range[0]) found = a;
    return found;
  }

  function setProgress(p) {
    progress = clamp01(p);
    // The debug slider and a ScrollTrigger refresh can both fire before
    // main.js has registered anything; without this, actAt() returns
    // undefined and the whole page dies on `active.range`.
    if (!acts.length) return;

    const next = actAt(progress);
    if (next !== active) {
      active?.exit?.(ctx);
      active = next;
      active.enter?.(ctx);
    }
    const [s, e] = active.range;
    active._t = e === s ? 1 : clamp01((progress - s) / (e - s));
    active.update?.(active._t, ctx);
  }

  function attachScroll() {
    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);
    // Whole-document scrub: the spec's act table assigns each act a range of
    // DOM sections spanning the full page (Act 4 covers Clients→Contact), so
    // global progress is document progress.
    ScrollTrigger.create({
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1,
      onUpdate: (self) => setProgress(self.progress),
    });
  }

  window.__tccDirector = director;
  return director;
}

export function mountDebugScrub(director) {
  if (new URLSearchParams(location.search).get('debug') !== '1') return null;

  const box = document.createElement('div');
  box.id = 'tcc-debug';
  box.style.cssText =
    'position:fixed;left:16px;bottom:16px;z-index:999;background:#000;color:#fff;' +
    'padding:10px 14px;border-radius:999px;font:11px/1 monospace;display:flex;gap:10px;align-items:center';
  box.innerHTML =
    '<input type="range" min="0" max="1000" value="0" style="width:280px" aria-label="Act progress">' +
    '<span>0.000 · —</span>';
  document.body.appendChild(box);

  const slider = box.querySelector('input');
  const label = box.querySelector('span');

  const sync = (p) => {
    label.textContent = `${p.toFixed(3)} · ${director.activeAct?.id ?? '—'}`;
  };
  slider.addEventListener('input', () => {
    const p = slider.valueAsNumber / 1000;
    director.setProgress(p);
    sync(p);
  });

  // Show where we actually are, not a hardcoded "0.000 · —". In ?shot=1 the
  // director is already parked at 0.04, so a stale label would misreport the
  // one thing this instrument exists to tell you.
  slider.value = String(Math.round(director.progress * 1000));
  sync(director.progress);
  return box;
}
