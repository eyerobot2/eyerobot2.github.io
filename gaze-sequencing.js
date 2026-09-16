/* No simulation, timers, or animation loop: selection only changes emphasis. */
(() => {
  const root = document.querySelector('.gaze-sequencing');
  if (!root) return;
  const diagram = root.querySelector('.diagram');
  const buttons = [...root.querySelectorAll('button[data-mode]')];
  const parts = [...diagram.querySelectorAll('[data-focus]')];
  const modes = new Set(['all', 'bc', 'gaze', 'rl']);
  function select(mode) {
    if (!modes.has(mode)) return;
    diagram.dataset.mode = mode;
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    for (const part of parts) part.classList.toggle('is-active', mode !== 'all' && part.dataset.focus.split(' ').includes(mode));
  }
  for (const button of buttons) button.addEventListener('click', () => select(button.dataset.mode));
  // Start with a concrete example; Overview restores the complete figure.
  select('bc');
  const viewport = root.querySelector('.figure-scroll');
  const hint = root.querySelector('.scroll-hint');
  function updateScrollHint() { hint.hidden = viewport.scrollWidth <= viewport.clientWidth + 1; }
  updateScrollHint();
  if ('ResizeObserver' in window) new ResizeObserver(updateScrollHint).observe(viewport);
})();
