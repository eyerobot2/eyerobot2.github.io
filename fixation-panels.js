(() => {
    'use strict';
    const root = document.querySelector('.fixation-panels');
    if (!root) return;
    const slides = [...root.querySelectorAll('.fixation-slide')];
    const track = root.querySelector('.fixation-carousel-track');
    const taskButtons = [...root.querySelectorAll('[data-task]')];
    let active = 0;
    const player = SiteMedia.createPlayer(root, slides, { synchronize: true });
    root.querySelector('.fixation-carousel-nav').hidden = false;
    root.querySelectorAll('.carousel-button').forEach(arrow => { arrow.hidden = false; });
    const showSlide = index => {
        active = (index + slides.length) % slides.length;
        track.style.transform = `translateX(-${active * 100}%)`;
        slides.forEach((slide, i) => {
            slide.setAttribute('aria-hidden', String(i !== active));
            slide.inert = i !== active;
        });
        taskButtons.forEach((task, i) => {
            task.setAttribute('aria-pressed', String(i === active));
            task.classList.toggle('current-slide', i === active);
        });
        player.select(active);
    };
    taskButtons.forEach(task => task.addEventListener('click', () => showSlide(Number(task.dataset.task))));
    root.querySelector('.fixation-prev').addEventListener('click', () => showSlide(active - 1));
    root.querySelector('.fixation-next').addEventListener('click', () => showSlide(active + 1));
    root.addEventListener('keydown', event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        showSlide(active + (event.key === 'ArrowRight' ? 1 : -1));
        taskButtons[active].focus();
    });
})();
