/* Desktop: the hero (title through teaser) fills the first screen. The first
   downward wheel or key press anywhere in it glides to the intro; scrolling up is
   never taken over. Touch devices and narrow windows keep native scrolling. */
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

  const destination = () => Math.round(target.getBoundingClientRect().top + scrollY - 28);
  // In very short windows the hero overflows, and snapping would skip the teaser.
  const heroFits = () => hero.offsetTop + hero.offsetHeight <= innerHeight + 4;
  const inHero = () => desktop.matches && heroFits() && scrollY < destination() - 2;
  let animating = false;
  let swallowUntil = 0;

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

  // Trackpads keep sending momentum wheel events for ~1s; swallow them until they
  // pause so the page doesn't keep coasting past the intro once the snap lands.
  addEventListener('wheel', event => {
    if (event.ctrlKey) return;
    const now = performance.now();
    if (animating || now < swallowUntil) {
      event.preventDefault();
      swallowUntil = now + 160;
      return;
    }
    if (event.deltaY > 0 && inHero()) {
      event.preventDefault();
      swallowUntil = now + 160;
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
    if (inHero()) {
      event.preventDefault();
      snap();
    }
  });
})();
