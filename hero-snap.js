/* Desktop: the hero (title through teaser) fills the first screen. A downward
   wheel or key press at the very top of the page glides to the intro; anywhere
   else (including partway back up) scrolling stays native. Touch devices and
   narrow windows keep native scrolling. */
(() => {
  const hero = document.querySelector('.page-hero');
  const start = document.getElementById('section-index-start');
  const target = start && start.nextElementSibling;
  if (!hero || !target) return;

  // Keep in sync with the @media gate on .page-hero in style.css.
  const desktop = matchMedia('(min-width: 751px) and (pointer: fine)');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  // Body margin + padding sit above the hero; subtract them so it ends at the fold.
  const measureTop = () => hero.style.setProperty('--hero-top', `${hero.offsetTop}px`);
  measureTop();
  addEventListener('resize', measureTop);

  // Size the TL;DR line to span most of the teaser's width. A bigger line leaves
  // less height for the teaser, which narrows it, so iterate until they agree.
  const tldr = hero.querySelector('h1.tldr');
  const video = document.getElementById('main-video');
  const fitTldr = () => {
    if (!tldr || !video) return;
    tldr.style.fontSize = '';
    if (!desktop.matches) return;
    const range = document.createRange();
    range.selectNodeContents(tldr);
    tldr.style.fontSize = '20px';
    const widthAt20 = range.getBoundingClientRect().width;
    // Never smaller than 20px (one line in the column) unless the window is too narrow.
    const floor = Math.min(widthAt20, innerWidth - 48);
    let size = 20;
    for (let i = 0; i < 6; i++) {
      tldr.style.fontSize = `${size}px`;
      const target = Math.max(0.82 * video.getBoundingClientRect().width, floor);
      const next = Math.min(36, 20 * target / widthAt20);
      if (Math.abs(next - size) < 0.2) break;
      size = next;
    }
  };
  let fitQueued = false;
  const queueFit = () => {
    if (fitQueued) return;
    fitQueued = true;
    requestAnimationFrame(() => { fitQueued = false; fitTldr(); });
  };
  fitTldr();
  addEventListener('resize', queueFit);
  document.fonts?.ready.then(queueFit);

  // Land with the intro heading near the top and the teaser fully scrolled away.
  const heading = target.querySelector('h1') || target;
  const destination = () => Math.round(scrollY + Math.max(
    heading.getBoundingClientRect().top - 16,
    hero.getBoundingClientRect().bottom,
  ));
  // In very short windows the hero overflows, and snapping would skip the teaser.
  const heroFits = () => hero.offsetTop + hero.offsetHeight <= innerHeight + 4;
  const atTop = () => desktop.matches && heroFits() && scrollY <= 4;
  let animating = false;
  let swallowUntil = 0;
  let swallowCap = 0;
  let lastDelta = 0;

  function snap() {
    if (animating) return;
    const from = scrollY;
    const to = destination();
    if (reduceMotion.matches) {
      scrollTo({ top: to, behavior: 'instant' });
      return;
    }
    animating = true;
    const startTime = performance.now();
    const duration = 650;
    const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = now => {
      const t = Math.min((now - startTime) / duration, 1);
      scrollTo({ top: from + (to - from) * ease(t), behavior: 'instant' });
      if (t < 1) requestAnimationFrame(step);
      else animating = false;
    };
    requestAnimationFrame(step);
  }

  // Trackpads keep sending momentum wheel events for ~1s; swallow them so the page
  // doesn't coast past the intro once the snap lands. Momentum only decays, so a
  // delta that grows (or reverses) is a fresh gesture and scrolls normally.
  hero.querySelector('.hero-scroll-cue')?.addEventListener('click', snap);
  addEventListener('wheel', event => {
    if (event.ctrlKey) return;
    const now = performance.now();
    const delta = event.deltaY;
    if (animating) {
      event.preventDefault();
      lastDelta = delta;
      swallowUntil = now + 160;
      return;
    }
    if (now < swallowUntil && now < swallowCap) {
      const fresh = delta < 0 || Math.abs(delta) > Math.abs(lastDelta) * 1.2 + 2;
      lastDelta = delta;
      if (!fresh) {
        event.preventDefault();
        swallowUntil = now + 160;
        return;
      }
      swallowUntil = 0;
    }
    if (delta > 0 && atTop()) {
      event.preventDefault();
      lastDelta = delta;
      swallowUntil = now + 160;
      swallowCap = now + 1200;
      snap();
    }
  }, { passive: false });

  addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const down = event.key === 'ArrowDown' || event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey);
    if (!down) return;
    const focused = document.activeElement;
    if (focused && focused.matches('video, input, textarea, select, button, [contenteditable]')) return;
    if (animating) {
      event.preventDefault();
      return;
    }
    if (atTop()) {
      event.preventDefault();
      snap();
    }
  });
})();
