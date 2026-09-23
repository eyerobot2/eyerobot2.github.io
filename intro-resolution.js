/* Shared playback keeps the magnified region aligned with its overview. */
document.addEventListener('DOMContentLoaded', () => {
    const figure = document.querySelector('.intro-resolution-inset');
    if (!figure) return;
    const composition = figure.querySelector('.intro-resolution-composition');
    const videos = [...composition.querySelectorAll('video')];
    const player = SiteMedia.createPlayer(figure, [composition], {synchronize: true});
    // A 16px patch at 256px input width spans 100px in the 1600px source.
    // Both grids use the source origin, including the magnified crop.
    const gridViews = [...composition.querySelectorAll('.intro-token-grid')].map((svg, i) => {
        const prefix = `intro-patches-${i}`;
        svg.innerHTML = `<defs>
            <pattern id="${prefix}-high" width="16" height="16" patternUnits="userSpaceOnUse">
                <path d="M16 0H0V16" fill="none" stroke="#263640" stroke-opacity=".48" stroke-width="1.2"/>
            </pattern>
            <pattern id="${prefix}-low" width="100" height="100" patternUnits="userSpaceOnUse">
                <path d="M100 0H0V100" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3"/>
                <path d="M100 0H0V100" fill="none" stroke="#263640" stroke-opacity=".75" stroke-width="1.8"/>
            </pattern>
        </defs>
        <rect class="token-high" x="0" y="0" width="0" height="1200" fill="url(#${prefix}-high)"/>
        <rect class="token-low" x="0" y="0" width="1600" height="1200" fill="url(#${prefix}-low)"/>
        ${svg.dataset.tokenView === 'overview' ? '<rect x="720" y="500" width="320" height="240" fill="none" stroke="#7f8e98" stroke-width="1" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>' : ''}`;
        return {high: svg.querySelector('.token-high'), low: svg.querySelector('.token-low')};
    });
    const densityLabel = composition.querySelector('.intro-token-density');
    const updateGrids = time => {
        const frame = Math.floor((time % 8) * 30 + .001);
        const edge = Math.round(1600 * (1 - Math.cos(2 * Math.PI * frame / 240)) / 2);
        // Fade the annotation in as the dense grid takes over, in video time
        // so pausing and seeking keep the label aligned with the sweep.
        if (densityLabel) densityLabel.style.opacity = Math.max(0, Math.min(1, (edge / 1600 - .4) / .25));
        gridViews.forEach(({high, low}) => {
            high.setAttribute('width', edge);
            low.setAttribute('x', edge);
            low.setAttribute('width', 1600 - edge);
        });
    };
    const overview = videos[0];
    updateGrids(0);
    if ('requestVideoFrameCallback' in overview) {
        const frameReady = (_, metadata) => {
            updateGrids(metadata.mediaTime);
            overview.requestVideoFrameCallback(frameReady);
        };
        overview.requestVideoFrameCallback(frameReady);
    } else {
        overview.addEventListener('timeupdate', () => updateGrids(overview.currentTime));
    }
    overview.addEventListener('seeked', () => updateGrids(overview.currentTime));
    // Correct decoder drift twice a second, without a per-frame drawing loop.
    // Drift is measured around the loop, so the overview wrapping to 0 while the
    // detail finishes its last frames isn't mistaken for an 8s gap. Small drift is
    // absorbed by nudging the detail's rate; only a large gap seeks, since each
    // seek stalls a phone decoder for a moment.
    const baseRate = Number(videos[1]?.dataset.playbackRate) || 1;
    setInterval(() => {
        const [overview, detail] = videos;
        if (document.hidden || overview.paused || detail.paused || detail.readyState < 2) return;
        const duration = overview.duration;
        if (!Number.isFinite(duration) || duration <= 0) return;
        let drift = (overview.currentTime - detail.currentTime) % duration;
        if (drift > duration / 2) drift -= duration;
        if (drift < -duration / 2) drift += duration;
        if (Math.abs(drift) > .5) {
            detail.currentTime = overview.currentTime;
            detail.playbackRate = baseRate;
        } else {
            // Behind: run up to 10% faster; ahead: slower. Back to base when close.
            const nudge = Math.abs(drift) < .04 ? 0 : Math.max(-.1, Math.min(.1, drift));
            detail.playbackRate = baseRate * (1 + nudge);
        }
    }, 500);
});
