/* Shared playback keeps the magnified region aligned with its overview. */
document.addEventListener('DOMContentLoaded', () => {
    const figure = document.querySelector('.intro-resolution-inset');
    if (!figure) return;
    const composition = figure.querySelector('.intro-resolution-composition');
    const videos = [...composition.querySelectorAll('video')];
    const player = SiteMedia.createPlayer(figure, [composition], {synchronize: true});
    // Correct decoder drift twice a second, without a per-frame drawing loop.
    setInterval(() => {
        const [overview, detail] = videos;
        if (!document.hidden && !overview.paused && detail.readyState >= 2 &&
                Math.abs(overview.currentTime - detail.currentTime) > .08) {
            detail.currentTime = overview.currentTime;
        }
    }, 500);
});
