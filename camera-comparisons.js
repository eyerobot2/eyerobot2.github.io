/* Task selection uses the same bounded media loader as the main carousels. */
(() => {
    'use strict';
    document.querySelectorAll('[data-intro-boba-videos]').forEach(root => {
        if (window.SiteMedia) SiteMedia.createPlayer(root, [root]);
    });
    document.querySelectorAll('.camera-samples').forEach(root => {
        const panels = [...root.querySelectorAll('.camera-trial')];
        const buttons = [...root.querySelectorAll('[data-camera-index]')];
        if (!panels.length || !window.SiteMedia) return;
        const player = SiteMedia.createPlayer(root, panels);
        let active = 0;
        const select = index => {
            active = (index + panels.length) % panels.length;
            panels.forEach((panel, i) => { panel.hidden = i !== active; panel.inert = i !== active; });
            buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === active)));
            player.select(active);
        };
        buttons.forEach((button, i) => button.addEventListener('click', () => select(i)));
        root.querySelector('.camera-task-buttons').addEventListener('keydown', event => {
            if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
            event.preventDefault();
            select(event.key === 'Home' ? 0 : event.key === 'End' ? panels.length-1 : active + (event.key === 'ArrowRight' ? 1 : -1));
            buttons[active].focus({preventScroll:true});
        });
        root.dataset.cameraReady = 'true';
    });
})();
