document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.carousel-container').forEach(container => {
        const track = container.querySelector('.carousel-track');
        if (!track) return;
        const slides = [...track.children];
        const viewport = container.querySelector('.carousel-track-container');
        const nav = container.querySelector('.carousel-nav');
        const dots = nav ? [...nav.children] : [];
        const player = SiteMedia.createPlayer(container, slides);
        let active = 0;
        const align = () => {
            if (!viewport || !slides[active]) return;
            const slide = slides[active];
            const raw = slide.offsetLeft - slides[0].offsetLeft -
                (viewport.getBoundingClientRect().width - slide.getBoundingClientRect().width) / 2;
            const maximum = Math.max(0, track.scrollWidth - viewport.getBoundingClientRect().width);
            track.style.transform = `translateX(-${Math.min(Math.max(raw, 0), maximum)}px)`;
        };
        const render = () => {
            slides.forEach((slide, index) => {
                slide.classList.toggle('current-slide', index === active);
                slide.setAttribute('aria-hidden', String(index !== active));
                slide.inert = index !== active;
            });
            dots.forEach((dot, index) => {
                dot.classList.toggle('current-slide', index === active);
                dot.setAttribute('aria-pressed', String(index === active));
                if (!dot.hasAttribute('aria-label')) dot.setAttribute('aria-label', `Show slide ${index + 1}`);
            });
            align();
        };
        const select = index => {
            active = (index + slides.length) % slides.length;
            render();
            player.select(active);
        };
        container.querySelector('.carousel-button--left')?.addEventListener('click', () => select(active - 1));
        container.querySelector('.carousel-button--right')?.addEventListener('click', () => select(active + 1));
        dots.forEach((dot, index) => dot.addEventListener('click', () => select(index)));
        nav?.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            select(event.key === 'Home' ? 0 : event.key === 'End' ? slides.length - 1 :
                active + (event.key === 'ArrowRight' ? 1 : -1));
            dots[active]?.focus({ preventScroll: true });
        });
        if (viewport && window.PointerEvent) {
            let start;
            viewport.addEventListener('pointerdown', event => {
                if (event.pointerType === 'mouse' || event.target.closest('button, input')) return;
                start = { x: event.clientX, y: event.clientY };
            }, { passive: true });
            viewport.addEventListener('pointerup', event => {
                if (!start) return;
                const dx = event.clientX - start.x;
                const dy = event.clientY - start.y;
                start = null;
                if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy)) select(active + (dx < 0 ? 1 : -1));
            }, { passive: true });
            viewport.addEventListener('pointercancel', () => { start = null; }, { passive: true });
        }
        window.addEventListener('resize', align);
        render();
    });
    document.querySelectorAll('video:not(.carousel-track video):not(.fixation-panels video)')
        .forEach(video => {
            if (!video.hidden && video.style.display !== 'none') SiteMedia.createPlayer(video, [video]);
        });
});
