/* Responsive teaser heading sizing. Page scrolling remains native. */
(() => {
  const hero = document.querySelector('.page-hero');
  if (!hero) return;

  // Keep in sync with the @media gate on .page-hero in style.css.
  const desktop = matchMedia('(min-width: 751px) and (pointer: fine)');

  // Fit the TL;DR to the width-driven teaser without changing the video size.
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
    const target = Math.max(0.82 * video.getBoundingClientRect().width, floor);
    tldr.style.fontSize = `${Math.min(36, 20 * target / widthAt20)}px`;
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

})();
