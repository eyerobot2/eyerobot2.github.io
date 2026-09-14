/* Gaze-only animation: the camera artwork and both lens endpoints stay fixed. */
(() => {
    'use strict';
    const root = document.getElementById('gaze-transformer');
    if (!root) return;
    const part = name => root.querySelector(`#gt-${name}`);
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const narrow = matchMedia('(max-width: 640px)');

    // Reflow the same editable layers on phones instead of shrinking every label.
    // The camera and ray coordinates remain local to their shared illustration.
    const mobileAttributes = [
        [part('gaze-figure'), { viewBox: '0 0 760 1070', width: '760', height: '1070' }],
        [part('stereo-inputs'), { transform: 'translate(-16 27) scale(.36)' }],
        [part('stereo-inputs').querySelector('text'), { x: '415', style: 'font-size:96px' }],
        [part('eye-state'), { transform: 'translate(-2 0) scale(.55)' }],
        [part('eye-state').querySelector('.diagram-label'), { style: 'font-size:64px' }],
        [part('eye-state').querySelector('.math'), { 'font-size': '72' }],
        [part('goal-prompt'), { transform: 'translate(0 -11) scale(.62)' }],
        [part('goal-prompt').querySelector('.diagram-label'), { style: 'font-size:56px' }],
        [part('goal-prompt').querySelector('rect'), { x: '832', width: '380' }],
        [part('prompt-text'), { style: 'font-size:48px;fill:#606060' }],
        [part('projection-label').querySelector('text'), {
            x: '288', y: '220', 'text-anchor': 'middle', style: 'font-size:30px;fill:#5e6f65',
        }],
        [part('policy-block').querySelector('rect'), { x: '24', y: '245', width: '712', height: '110', rx: '18' }],
        [part('policy-text'), { x: '380', y: '314', style: 'font-size:48px' }],
        [part('left-flow'), { d: 'M77.6 160V242' }],
        [part('right-flow'), { d: 'M171.92 160V242' }],
        [part('state-flow'), { d: 'M405.55 173V242' }],
        [part('prompt-flow'), { d: 'M633.64 153V242' }],
        [part('output-flow'), { d: 'M380 365V421' }],
        [part('motion-outputs'), { transform: 'translate(8 -220)' }],
        [part('gaze-illustration'), { transform: 'translate(-770 60)' }],
        [part('motion-label'), { y: '974' }],
    ].map(([node, attributes]) => ({
        node,
        attributes,
        original: Object.fromEntries(Object.keys(attributes).map(name => [name, node.getAttribute(name)])),
    }));
    function layout() {
        mobileAttributes.forEach(({ node, attributes, original }) => {
            Object.entries(narrow.matches ? attributes : original).forEach(([name, value]) => {
                if (value === null) node.removeAttribute(name);
                else node.setAttribute(name, value);
            });
        });
    }
    narrow.addEventListener('change', layout);
    layout();

    const targetAtRest = { x: 920, y: 910 };
    const origin = { x: 1189.5, y: 754 };
    const distanceAtRest = Math.hypot(targetAtRest.x - origin.x, targetAtRest.y - origin.y);
    const directionAtRest = Math.atan2(targetAtRest.y - origin.y, targetAtRest.x - origin.x);
    const dot = part('fixation-dot');
    const motionLabel = part('motion-label');
    const rays = [
        { node: part('left-ray'), x: 1074, y: 716 },
        { node: part('right-ray'), x: 1305, y: 792 },
    ];
    const highlights = [
        ['theta-key', 'direction'], ['phi-key', 'direction'], ['depth-key', 'depth'],
        ['direction-caption', 'direction'], ['depth-caption', 'depth'],
        ['direction-guide', 'direction'], ['depth-guide', 'depth'],
    ].map(([name, phase]) => ({ node: part(name), phase }));
    const polar = (distance, direction = directionAtRest) => ({
        x: origin.x + distance * Math.cos(direction),
        y: origin.y + distance * Math.sin(direction),
    });
    const near = polar(distanceAtRest - 94);
    const far = polar(distanceAtRest + 94);
    part('depth-guide').setAttribute('d', `M${near.x} ${near.y} L${far.x} ${far.y}`);
    const arcStart = polar(distanceAtRest, directionAtRest - .235);
    const arcEnd = polar(distanceAtRest, directionAtRest + .235);
    part('direction-guide').setAttribute('d', `M${arcStart.x} ${arcStart.y} A${distanceAtRest} ${distanceAtRest} 0 0 1 ${arcEnd.x} ${arcEnd.y}`);

    let phase = null;
    let frame = null;
    let previousTime = null;
    let elapsed = 0;
    let visible = false;

    function setPhase(next) {
        phase = next;
        highlights.forEach(item => item.node.classList.toggle('active', item.phase === next));
        motionLabel.textContent = next === 'depth' ? 'Depth' : next === 'direction' ? 'Direction' : 'Direction · depth';
        motionLabel.setAttribute('dy', next === 'direction' ? '12' : '0');
    }

    function setTarget(target) {
        dot.setAttribute('cx', target.x);
        dot.setAttribute('cy', target.y);
        rays.forEach(ray => ray.node.setAttribute('d', `M${target.x} ${target.y} ${ray.x} ${ray.y}`));
    }

    function smoothstep(value) {
        const t = Math.max(0, Math.min(1, value));
        return t * t * (3 - 2 * t);
    }

    function render(seconds) {
        // One 1.7-second wiggle and a 0.3-second rest per phase.
        const nextPhase = Math.floor(seconds / 2) % 2 === 0 ? 'depth' : 'direction';
        const local = seconds % 2;
        const envelope = smoothstep(local / .27) * smoothstep((1.7 - local) / .27);
        const wiggle = Math.sin(local * Math.PI * 2 / 1.7) * envelope;
        if (nextPhase !== phase) setPhase(nextPhase);
        setTarget(polar(
            distanceAtRest + (phase === 'depth' ? 70 * wiggle : 0),
            directionAtRest + (phase === 'direction' ? .17 * wiggle : 0),
        ));
    }

    function tick(now) {
        if (previousTime !== null) elapsed += (now - previousTime) / 1000;
        previousTime = now;
        render(elapsed);
        frame = requestAnimationFrame(tick);
    }

    function syncPlayback() {
        if (visible && !document.hidden && !preference.matches) {
            if (frame === null) frame = requestAnimationFrame(tick);
        } else {
            cancelAnimationFrame(frame);
            frame = null;
            previousTime = null;
        }
    }

    preference.addEventListener('change', () => {
        if (preference.matches) {
            elapsed = 0;
            setPhase(null);
            setTarget(targetAtRest);
        }
        syncPlayback();
    });
    document.addEventListener('visibilitychange', syncPlayback);
    const observer = new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        syncPlayback();
    });
    observer.observe(root);
    syncPlayback();
})();
