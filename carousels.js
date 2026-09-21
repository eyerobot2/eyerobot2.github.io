document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.carousel-container').forEach(container => {
        const track = container.querySelector('.carousel-track');
        if (!track) return;
        const slides = [...track.children];
        const viewport = container.querySelector('.carousel-track-container');
        const nav = container.querySelector('.carousel-nav');
        const dots = nav ? [...nav.children] : [];
        const taskTabs = [...container.querySelectorAll('[data-carousel-task]')];
        let task = taskTabs[0]?.dataset.carouselTask;
        const available = () => slides.map((slide, index) => ({slide, index}))
            .filter(({slide}) => !taskTabs.length || slide.dataset.carouselGroup === task)
            .map(({index}) => index);
        const hasGazeInset = container.matches('.real-results-carousel-container');
        const player = SiteMedia.createPlayer(container, slides, { synchronize: hasGazeInset });
        if (hasGazeInset) {
            const focusToggle = document.createElement('button');
            focusToggle.type = 'button';
            focusToggle.className = 'results-focus-toggle';
            focusToggle.textContent = 'Enlarge gaze ↗';
            focusToggle.setAttribute('aria-pressed', 'false');
            container.querySelector('.results-gallery-arrows').prepend(focusToggle);
            focusToggle.addEventListener('click', () => {
                const views = [...container.querySelectorAll('.current-slide .results-robot-view, .current-slide .results-gaze-inset')];
                views.forEach(view => view.getAnimations().forEach(animation => animation.cancel()));
                const before = views.map(view => view.getBoundingClientRect());
                const gazeIsLarge = container.classList.toggle('results-gaze-focused');
                container.querySelectorAll('.results-gaze-label').forEach(label => {
                    label.textContent = gazeIsLarge ? 'Policy gaze · left / right' : 'Policy gaze';
                });
                focusToggle.textContent = gazeIsLarge ? 'Enlarge robot ↗' : 'Enlarge gaze ↗';
                focusToggle.setAttribute('aria-pressed', String(gazeIsLarge));
                if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
                views.forEach((view, index) => {
                    const from = before[index], to = view.getBoundingClientRect();
                    const dx = from.left - to.left, dy = from.top - to.top;
                    const sx = from.width / to.width, sy = from.height / to.height;
                    view.animate([
                        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
                        { transform: `translate(${dx * .45}px, ${dy * .45 - 12}px) scale(${1 + (sx - 1) * .45}, ${1 + (sy - 1) * .45})`, offset: .5 },
                        { transform: 'none' },
                    ], { duration: 240, easing: 'cubic-bezier(.2,.7,.2,1)' });
                });
            });
        }
        if (hasGazeInset) slides.forEach(slide => {
            const robot = slide.querySelector('.results-robot-view video');
            const gaze = slide.querySelector('.results-gaze-inset video');
            if (!robot || !gaze) return;
            const followRobot = () => {
                if (gaze.readyState < 2 || !Number.isFinite(gaze.duration)) return;
                const time = Math.min(robot.currentTime, gaze.duration);
                if (Math.abs(gaze.currentTime - time) > 0.18) gaze.currentTime = time;
            };
            robot.addEventListener('seeking', followRobot);
            robot.addEventListener('timeupdate', followRobot);
            gaze.addEventListener('loadeddata', followRobot);
        });
        let active = 0;
        const align = () => {
            if (!viewport || !slides[active]) return;
            const slide = slides[active];
            const raw = slide.offsetLeft - slides[available()[0]].offsetLeft -
                (viewport.getBoundingClientRect().width - slide.getBoundingClientRect().width) / 2;
            const maximum = Math.max(0, track.scrollWidth - viewport.getBoundingClientRect().width);
            track.style.transform = `translateX(-${Math.min(Math.max(raw, 0), maximum)}px)`;
        };
        const render = () => {
            slides.forEach((slide, index) => {
                if (taskTabs.length) slide.hidden = slide.dataset.carouselGroup !== task;
                slide.classList.toggle('current-slide', index === active);
                slide.setAttribute('aria-hidden', String(index !== active));
                slide.inert = index !== active;
            });
            dots.forEach((dot, index) => {
                if (taskTabs.length) dot.hidden = slides[index].dataset.carouselGroup !== task;
                dot.classList.toggle('current-slide', index === active);
                dot.setAttribute('aria-pressed', String(index === active));
                if (!dot.hasAttribute('aria-label')) dot.setAttribute('aria-label', `Show slide ${index + 1}`);
            });
            taskTabs.forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.carouselTask === task)));
            const counter = container.querySelector('[data-carousel-counter]');
            if (counter) counter.textContent = `${slides[active].dataset.exampleLabel} · ${available().indexOf(active) + 1} / ${available().length}`;
            align();
        };
        const select = index => {
            active = (index + slides.length) % slides.length;
            render();
            player.select(active);
        };
        const advance = delta => {
            const choices = available();
            select(choices[(choices.indexOf(active) + delta + choices.length) % choices.length]);
        };
        const chooseTask = tab => {
            task = tab.dataset.carouselTask;
            // Task changes reset immediately; navigation within a task keeps its slide animation.
            track.style.transition = 'none';
            select(available()[0]);
            void track.offsetWidth;
            track.style.removeProperty('transition');
        };
        taskTabs.forEach(tab => tab.addEventListener('click', () => chooseTask(tab)));
        container.querySelector('.distractor-task-tabs')?.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const focused = taskTabs.indexOf(event.target.closest('[data-carousel-task]'));
            const current = focused >= 0 ? focused : taskTabs.findIndex(tab => tab.dataset.carouselTask === task);
            const index = event.key === 'Home' ? 0 : event.key === 'End' ? taskTabs.length - 1 :
                (current + (event.key === 'ArrowRight' ? 1 : -1) + taskTabs.length) % taskTabs.length;
            chooseTask(taskTabs[index]);
            taskTabs[index].focus({preventScroll: true});
        });
        container.querySelector('.carousel-button--left')?.addEventListener('click', () => advance(-1));
        container.querySelector('.carousel-button--right')?.addEventListener('click', () => advance(1));
        dots.forEach((dot, index) => dot.addEventListener('click', () => select(index)));
        nav?.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const choices = available();
            if (event.key === 'Home' || event.key === 'End') select(choices[event.key === 'Home' ? 0 : choices.length - 1]);
            else advance(event.key === 'ArrowRight' ? 1 : -1);
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
                if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy)) advance(dx < 0 ? 1 : -1);
            }, { passive: true });
            viewport.addEventListener('pointercancel', () => { start = null; }, { passive: true });
        }
        window.addEventListener('resize', align);
        render();
    });
    document.querySelectorAll('video:not(.carousel-track video):not(.fixation-panels video):not(.camera-comparisons video):not(.intro-resolution-inset video)')
        .forEach(video => {
            if (!video.hidden && video.style.display !== 'none') SiteMedia.createPlayer(video, [video]);
        });
});
