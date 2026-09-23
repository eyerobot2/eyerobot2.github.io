/* Model per-element gesture permission; this is not a real iOS device test. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { server } = require('./serve_media.cjs');
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        await context.addInitScript(() => {
            const play = HTMLMediaElement.prototype.play;
            const permission = new WeakSet();
            window.playCalls = [];
            HTMLMediaElement.prototype.play = function () {
                const event = window.event;
                const gesture = event?.isTrusted && ['click', 'touchend', 'keydown'].includes(event.type);
                window.playCalls.push({ id: this.id, gesture: Boolean(gesture) });
                if (gesture) permission.add(this);
                if (!permission.has(this)) return Promise.reject(new DOMException('Gesture required', 'NotAllowedError'));
                return play.call(this);
            };
        });
        const page = await context.newPage();
        const requests = [];
        page.on('request', r => requests.push(r.url()));
        const video = id => `<video id="${id}" controls muted loop playsinline preload="none" width="240" height="90"><source data-src="/data/camera-comparisons/boba-intro-wrists.mp4?${id}" type="video/mp4"></video>`;
        await page.route('**/gesture-fixture', route => route.fulfill({contentType:'text/html',body:`
            <link rel="stylesheet" href="/media.css"><script src="/media.js"></script>
            <h1>Tap here</h1><section id="first">${video('first-video')}</section>
            <button id="pause-first" onclick="SiteMedia.toggle(document.querySelector('#first-video'))">Pause first</button>
            <div style="height:1500px"></div><section id="pair">${video('pair-left')}${video('pair-right')}</section>
            <button id="play-pair" onclick="SiteMedia.toggle(document.querySelector('#pair-left'))">Play pair</button>
            <script>SiteMedia.createPlayer(document.querySelector('#first'), [document.querySelector('#first-video')]);
            SiteMedia.createPlayer(document.querySelector('#pair'), [document.querySelector('#pair')], {synchronize:true});</script>`}));
        await page.goto(`${base}/gesture-fixture`);
        await page.locator('#first .media-feedback button').waitFor({state:'visible'});
        await page.click('h1');
        await page.waitForFunction(() => !document.querySelector('#first-video').paused);
        assert(!requests.some(r => r.includes('?pair-')), 'Priming must not attach offscreen sources');
        await page.click('#pause-first');
        await page.waitForFunction(() => document.querySelector('#first-video').paused);
        const before = await page.evaluate(() => playCalls.filter(c => c.id === 'first-video').length);
        await page.click('h1');
        assert.equal(await page.evaluate(() => playCalls.filter(c => c.id === 'first-video').length), before,
            'A later tap must not call play on the manually paused player');
        assert(await page.locator('#first-video').evaluate(v => v.paused));
        await page.locator('#pair').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => [...document.querySelectorAll('#pair video')].every(v => !v.paused && v.readyState >= 3));
        assert(await page.locator('#first-video').evaluate(v => v.paused));
        console.log('PASS: blocked autoplay recovers, later pair plays, offscreen sources stay deferred, manual pause survives');
        await page.reload();
        await page.locator('#pair').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => [...document.querySelectorAll('#pair video')].every(v => v.readyState >= 2));
        await page.evaluate(() => document.querySelectorAll('#pair video').forEach(v =>
            Object.defineProperty(v, 'readyState', {configurable:true, get: () => 0})));
        await page.click('#play-pair');
        assert(await page.evaluate(() => ['pair-left','pair-right'].every(id =>
            playCalls.some(c => c.id === id && c.gesture))), 'Both cold videos need play() in the tap handler');
        console.log('PASS: paired playback calls play directly in the gesture, without waiting for canplay');
        await context.close();
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
