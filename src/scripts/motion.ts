/*
 * Marketing motion system — a dependency-free, reduced-motion-safe reproduction
 * of the design's md-motion.js. Runs on marketing pages (wired in MarketingLayout).
 *
 * Effects: scroll-reveal (fade), count-up, split-word heading reveal, scramble,
 * card hover gradient-border, 3D tilt, magnetic buttons, scroll-progress bar.
 * Everything is progressive enhancement: with no JS (or reduced motion) content
 * renders fully and statically.
 */

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(pointer: fine)').matches;
const hasIO = 'IntersectionObserver' in window;

function reveal(el: HTMLElement) {
  const delay = Number(el.dataset.revealDelay?.replace('ms', '') || 0);
  const run = () => {
    el.style.opacity = '1';
    el.style.transform = 'none';
  };
  if (delay) window.setTimeout(run, delay);
  else run();
}

function countUp(el: HTMLElement) {
  const to = Number(el.dataset.to || 0);
  const decimals = Number(el.dataset.decimals || 0);
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';
  const format = (v: number) => (el.textContent = prefix + v.toFixed(decimals) + suffix);
  if (reduce) {
    format(to);
    return;
  }
  const dur = 1400;
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / dur);
    format(to * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(tick);
    else format(to);
  };
  requestAnimationFrame(tick);
}

/** Split a plain-text heading into word spans that rise from a mask. */
function splitWords(el: HTMLElement): HTMLElement[] {
  const text = el.textContent ?? '';
  el.textContent = '';
  // Snap the container visible (override the reveal fade/slide) so only the
  // words animate, matching the design.
  el.style.transition = 'none';
  el.style.opacity = '1';
  el.style.transform = 'none';
  const inners: HTMLElement[] = [];
  for (const word of text.split(/(\s+)/)) {
    if (/^\s+$/.test(word)) {
      el.appendChild(document.createTextNode(word));
      continue;
    }
    const outer = document.createElement('span');
    outer.style.cssText =
      'display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.08em;margin-bottom:-.08em';
    const inner = document.createElement('span');
    inner.style.cssText =
      'display:inline-block;transform:translateY(112%);transition:transform .8s cubic-bezier(.19,1,.22,1)';
    inner.textContent = word;
    outer.appendChild(inner);
    el.appendChild(outer);
    inners.push(inner);
  }
  return inners;
}

function playWords(words: HTMLElement[]) {
  words.forEach((w, i) => window.setTimeout(() => (w.style.transform = 'translateY(0)'), i * 55));
}

function scramble(el: HTMLElement) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%&*<>/';
  const target = el.textContent ?? '';
  el.style.opacity = '1';
  const dur = Math.min(1400, 380 + target.length * 36);
  const start = performance.now();
  const rnd = () => chars[Math.floor(Math.random() * chars.length)];
  const tick = (now: number) => {
    const p = Math.min(1, (now - start) / dur);
    const revealCount = Math.floor(p * target.length);
    let out = '';
    for (let i = 0; i < target.length; i++) {
      const ch = target[i];
      out += i < revealCount || ch === ' ' || ch === '\n' ? ch : rnd();
    }
    el.textContent = out;
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  };
  requestAnimationFrame(tick);
}

function injectCardStyles() {
  if (document.getElementById('md-card-css')) return;
  const st = document.createElement('style');
  st.id = 'md-card-css';
  st.textContent = `
@property --md-a{syntax:'<angle>';inherits:false;initial-value:0deg}
@keyframes md-borderspin{to{--md-a:360deg}}
[data-card]{position:relative;isolation:isolate;transition:transform .3s cubic-bezier(.2,.7,.2,1),box-shadow .3s cubic-bezier(.2,.7,.2,1)}
[data-card]::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1.5px;background:conic-gradient(from var(--md-a),transparent 50%,#4f46e5 74%,#8b5cf6 84%,#ff441f 94%,transparent 100%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:0;transition:opacity .4s;pointer-events:none;z-index:2}
[data-card]:hover{transform:translateY(-4px)}
[data-card]:hover::before{opacity:1;animation:md-borderspin 3.2s linear infinite}`;
  document.head.appendChild(st);
}

function tilt(el: HTMLElement) {
  const max = Number(el.dataset.tilt || 6);
  el.style.transition = 'transform .3s cubic-bezier(.2,.7,.2,1)';
  el.addEventListener('mousemove', (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${px * max}deg) rotateX(${-py * max}deg)`;
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = 'perspective(900px) rotateY(0) rotateX(0)';
  });
}

function magnetic(el: HTMLElement) {
  const strength = Number(el.dataset.magnetic || 0.25);
  el.style.transition = 'transform .25s cubic-bezier(.2,.7,.2,1)';
  el.addEventListener('mousemove', (e) => {
    const r = el.getBoundingClientRect();
    el.style.transform = `translate(${(e.clientX - (r.left + r.width / 2)) * strength}px,${(e.clientY - (r.top + r.height / 2)) * strength}px)`;
  });
  el.addEventListener('mouseleave', () => (el.style.transform = 'translate(0,0)'));
}

function scrollProgress() {
  const bar = document.createElement('div');
  bar.setAttribute('aria-hidden', 'true');
  bar.style.cssText =
    'position:fixed;top:0;left:0;height:2px;width:0;z-index:200;background:linear-gradient(90deg,#4f46e5,#ff441f);transition:width .1s linear;pointer-events:none';
  document.body.appendChild(bar);
  const update = () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = `${h > 0 ? (window.scrollY / h) * 100 : 0}%`;
  };
  window.addEventListener('scroll', update, { passive: true });
  update();
}

function observe(nodes: HTMLElement[], onEnter: (el: HTMLElement) => void, threshold: number) {
  if (!hasIO) {
    nodes.forEach(onEnter);
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          onEnter(entry.target as HTMLElement);
          io.unobserve(entry.target);
        }
      }
    },
    { threshold, rootMargin: '0px 0px -6% 0px' }
  );
  nodes.forEach((n) => io.observe(n));
}

/*
 * Query helper that EXCLUDES elements owned by a React island (`<astro-island>`).
 * This module mutates the DOM (splitting/scrambling text, setting inline styles),
 * and doing that inside an island before React hydrates causes a hydration
 * mismatch — so island-owned nodes are left entirely to React.
 */
function q(selector: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.closest('astro-island')
  );
}

function init() {
  injectCardStyles();

  // Split-word candidates: display/section headings that are plain text.
  const splitEls = q('.display, .h-section, [data-split]').filter(
    (el) => el.children.length === 0 && (el.textContent ?? '').trim().length > 0
  );
  const splitSet = new Set<HTMLElement>(splitEls);

  // Count-up (always finalize; animate only when motion is allowed).
  const counts = q('[data-count]');
  if (reduce) {
    counts.forEach(countUp);
  } else {
    observe(counts, countUp, 0.4);
  }

  if (reduce) return; // reveal/split/scramble/tilt/magnetic/progress are motion — skip.

  // Scroll-reveal for everything except the split headings.
  observe(
    q('[data-reveal]').filter((el) => !splitSet.has(el)),
    reveal,
    0.08
  );

  // Split-word heading reveal.
  const wordMap = new WeakMap<HTMLElement, HTMLElement[]>();
  splitEls.forEach((el) => wordMap.set(el, splitWords(el)));
  observe(splitEls, (el) => playWords(wordMap.get(el) ?? []), 0.2);

  // Scramble headings (footer CTA).
  observe(q('[data-scramble]'), scramble, 0.3);

  // Pointer-driven effects (fine pointers only).
  if (fine) {
    q('[data-tilt]').forEach(tilt);
    q('[data-magnetic]').forEach(magnetic);
  }

  scrollProgress();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
