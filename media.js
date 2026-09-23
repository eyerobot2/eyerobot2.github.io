/* Shared, bounded video loading for the project page. */
(() => {
    'use strict';
    const owners = new WeakMap();
    const records = new WeakMap();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const connection = navigator.connection;
    const mayPrefetch = () => !connection?.saveData &&
        !['slow-2g', '2g'].includes(connection?.effectiveType);

    const recordFor = video => {
        if (!records.has(video)) records.set(video, {
            attached: false, desired: false, revision: 0, pending: null, time: 0,
        });
        return records.get(video);
    };
    const poster = video => {
        if (video.dataset.poster && !video.hasAttribute('poster')) {
            video.poster = video.dataset.poster;
        }
    };
    const prepare = (video, preload = 'metadata') => {
        poster(video);
        const state = recordFor(video);
        video.preload = preload;
        if (state.attached) return;
        if (video.dataset.src) video.src = video.dataset.src;
        video.querySelectorAll('source[data-src]').forEach(source => {
            source.src = source.dataset.src;
        });
        state.attached = true;
        video.load();
    };
    const pause = video => {
        const state = recordFor(video);
        state.desired = false;
        ++state.revision;
        state.pending = null;
        video.pause();
    };
    // Retry blocked players in a real gesture. Priming offscreen elements is
    // best-effort: browsers need not retain permission after sources change.
    const blocked = new Set();
    const primed = new WeakSet();
    let refused = false;
    const unlock = event => {
        if (!refused || reduced.matches || !event.isTrusted) return;
        // Let controls handle their own gesture; don't turn a pause tap into play.
        if (event.target.closest?.('button, input, select, textarea, a, video, [contenteditable], [role="button"]')) return;
        if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
        const players = [...blocked];
        blocked.clear();
        players.forEach(resume => resume());
        document.querySelectorAll('video').forEach(video => {
            const owner = owners.get(video);
            if (!owner?.canPrime(video) || primed.has(video)) return;
            primed.add(video);
            // No source attachment or background downloads. Pause immediately,
            // including when play() leaves a pending promise on an empty element.
            video.play()?.catch(() => {});
            video.pause();
        });
    };
    ['touchend', 'click', 'keydown'].forEach(type =>
        document.addEventListener(type, unlock, { capture: true, passive: true }));

    const release = video => {
        const state = recordFor(video);
        if (!state.attached) return;
        if (Number.isFinite(video.currentTime)) state.time = video.currentTime;
        pause(video);
        state.attached = false;
        video.removeAttribute('src');
        video.querySelectorAll('source').forEach(source => source.removeAttribute('src'));
        video.preload = 'none';
        video.load(); // Cancel downloads and release media buffers/decoders.
    };

    function createPlayer(root, slides, { synchronize = false } = {}) {
        const groups = slides.map(slide => [
            ...(slide.matches('video') ? [slide] : slide.querySelectorAll('video')),
        ]);
        const videos = groups.flat();
        let active = 0;
        let inView = false;
        let near = false;
        let wantsPlayback = !reduced.matches;
        let pausedByUser = false;
        let message = '';
        let releaseTimer;
        let warmTimer;
        let loadingTimer;
        let slow = false;
        const failures = new Set();

        const feedback = document.createElement('div');
        feedback.className = 'media-feedback';
        const status = document.createElement('span');
        status.setAttribute('role', 'status');
        const action = document.createElement('button');
        action.type = 'button';
        feedback.append(status, action);
        if (root.matches('video')) root.insertAdjacentElement('afterend', feedback);
        else root.append(feedback);

        const current = () => groups[active];
        const allowed = video => current().includes(video) && inView &&
            !document.hidden && wantsPlayback;
        const loading = () => wantsPlayback && inView && !document.hidden &&
            current().some(video => video.readyState < 3);
        const updateFeedback = () => {
            const failed = current().some(video => failures.has(video));
            const waiting = loading();
            status.textContent = failed ? 'Video could not load.' : message ||
                (waiting ? 'Loading video…' : '');
            action.textContent = failed || slow ? 'Retry' : 'Play';
            action.hidden = !failed && !slow && (wantsPlayback || pausedByUser) && !message;
            feedback.classList.toggle('is-visible', Boolean(status.textContent) || !action.hidden);
            if (waiting && !loadingTimer && !slow) {
                loadingTimer = setTimeout(() => {
                    loadingTimer = null;
                    slow = loading();
                    updateFeedback();
                }, 10000);
            } else if (!waiting) {
                clearTimeout(loadingTimer);
                loadingTimer = null;
                slow = false;
            }
        };
        const pauseAll = () => videos.forEach(pause);
        const evictOtherSlides = () => {
            const keepNext = inView && mayPrefetch() && wantsPlayback;
            groups.forEach((group, index) => {
                if (index !== active && (!keepNext || index !== (active + 1) % groups.length)) {
                    group.forEach(release);
                }
            });
        };
        const warmNext = () => {
            clearTimeout(warmTimer);
            if (groups.length < 2 || !mayPrefetch() || !inView || !wantsPlayback) return;
            warmTimer = setTimeout(() => {
                if (document.hidden || !inView || !wantsPlayback) return;
                // Wait for the selected slide to play before competing for bandwidth.
                if (current().some(video => video.paused || video.readyState < 3)) return;
                groups[(active + 1) % groups.length].forEach(video => prepare(video));
                evictOtherSlides();
            }, 1000);
        };
        const start = video => {
            const state = recordFor(video);
            if (!allowed(video) || failures.has(video) || state.pending ||
                (!video.paused && state.desired)) return;
            state.desired = true;
            const revision = ++state.revision;
            const pending = video.play();
            state.pending = pending;
            pending.then(() => {
                // Recheck intent, not just the promise that originally started playback.
                if (!allowed(video) || !state.desired) video.pause();
            }).catch(error => {
                if (revision !== state.revision || !allowed(video)) return;
                if (error.name === 'AbortError') return;
                if (error.name === 'NotAllowedError') {
                    message = 'Tap Play to start.';
                    wantsPlayback = false;
                    pauseAll();
                    refused = true;
                    blocked.add(resumeAfterGesture);
                } else {
                    failures.add(video);
                }
                updateFeedback();
            }).finally(() => {
                if (state.pending === pending) state.pending = null;
            });
        };
        const resumeAfterGesture = () => {
            if (pausedByUser || !message) return;
            message = '';
            wantsPlayback = !reduced.matches;
            update(true);
        };
        const update = (fromGesture = false) => {
            videos.filter(video => !allowed(video)).forEach(pause);
            if (inView && !document.hidden && wantsPlayback) {
                current().forEach(video => prepare(video, 'auto'));
                if (fromGesture === true || !synchronize || current().every(video => video.readyState >= 2)) {
                    if (synchronize && current().every(video => video.paused)) {
                        const time = current()[0].currentTime;
                        current().forEach(video => {
                            if (Math.abs(video.currentTime - time) > 1 / 24) video.currentTime = time;
                        });
                    }
                    current().forEach(start);
                }
            } else if (near && !document.hidden) {
                current().forEach(video => {
                    poster(video);
                    if (mayPrefetch() && wantsPlayback) prepare(video);
                });
            }
            updateFeedback();
        };
        const player = {
            canPrime(video) {
                return !pausedByUser && !reduced.matches && !document.hidden &&
                    video.paused && (!inView || !current().includes(video));
            },
            select(index) {
                pauseAll();
                pausedByUser = false;
                active = index;
                current().forEach(video => {
                    // Explicit navigation restarts the clip, including after
                    // its sources were evicted or its current tab was clicked.
                    recordFor(video).time = 0;
                    video.currentTime = 0;
                });
                message = '';
                slow = false;
                clearTimeout(loadingTimer);
                loadingTimer = null;
                wantsPlayback = !reduced.matches;
                evictOtherSlides();
                update();
            },
            toggle(video) {
                wantsPlayback = video.paused;
                pausedByUser = !wantsPlayback;
                message = '';
                update(true);
            },
        };
        action.addEventListener('click', () => {
            if (slow || current().some(video => failures.has(video))) {
                current().forEach(video => {
                    failures.delete(video);
                    release(video);
                });
            }
            slow = false;
            message = '';
            wantsPlayback = true;
            pausedByUser = false;
            update(true);
        });
        videos.forEach(video => {
            owners.set(video, player);
            video.autoplay = false;
            video.muted = true;
            const state = recordFor(video);
            video.addEventListener('loadedmetadata', () => {
                if (state.attached && state.time && Number.isFinite(video.duration)) {
                    video.currentTime = Math.min(state.time, Math.max(0, video.duration - 0.1));
                }
                if (video.dataset.playbackRate) video.playbackRate = Number(video.dataset.playbackRate);
            });
            video.addEventListener('canplay', update);
            video.addEventListener('play', () => {
                // Resume from the browser's native teaser controls.
                if (video.controls && !state.desired && inView &&
                    current().includes(video) && !document.hidden) {
                    wantsPlayback = true;
                    state.desired = true;
                }
                // A stale play event must never pause the selected slide.
                if (!allowed(video) || !state.desired) {
                    video.pause();
                    return;
                }
                updateFeedback();
            });
            video.addEventListener('playing', () => {
                if (!allowed(video)) { pause(video); return; }
                message = '';
                updateFeedback();
                warmNext();
            });
            video.addEventListener('pause', () => {
                // Native controls may pause the teaser. Programmatic pauses clear desired first.
                if (state.desired && video.paused && allowed(video) && !video.ended) {
                    wantsPlayback = false;
                    pausedByUser = true;
                    pauseAll();
                    updateFeedback();
                }
            });
            video.addEventListener('waiting', updateFeedback);
            video.addEventListener('stalled', updateFeedback);
            const fail = () => {
                if (!state.attached) return;
                failures.add(video);
                updateFeedback();
            };
            video.addEventListener('error', fail);
            // Exhausted <source> candidates do not consistently raise a video error.
            video.querySelector('source:last-of-type')?.addEventListener('error', fail);
        });
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(entries => {
                near = entries[0].isIntersecting;
                clearTimeout(releaseTimer);
                if (near) update();
                else releaseTimer = setTimeout(() => {
                    if (!near && !inView) videos.forEach(release);
                }, 10000);
            }, { rootMargin: '400px 0px' }).observe(root);
            new IntersectionObserver(entries => {
                inView = entries[0].isIntersecting;
                if (!inView) clearTimeout(warmTimer);
                update();
            }).observe(root);
        } else {
            near = inView = true;
            update();
        }
        document.addEventListener('visibilitychange', update);
        reduced.addEventListener('change', () => {
            wantsPlayback = !reduced.matches;
            update();
        });
        updateFeedback();
        return player;
    }

    window.SiteMedia = {
        createPlayer,
        toggle(video) {
            const owner = owners.get(video);
            if (owner) owner.toggle(video);
            else if (video.paused) video.play().catch(() => {});
            else video.pause();
        },
    };
})();
