/* Browser regressions. Requires Playwright + Chrome; see MEDIA_PERFORMANCE.md. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const types = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.mp4': 'video/mp4', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg',
    '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json',
};
// Serve byte ranges, as production does; Python's basic http.server cannot
// reliably exercise seeking and partial media downloads.
const server = http.createServer((req, res) => {
    let file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
    const size = fs.statSync(file).size;
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
    const range = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
    let start = 0, end = size - 1;
    if (range) {
        start = Number(range[1]);
        end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
        if (start > end) { res.writeHead(416).end(); return; }
        headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    }
    res.writeHead(range ? 206 : 200, { ...headers, 'Content-Length': end - start + 1 });
    const stream = fs.createReadStream(file, { start, end });
    res.on('close', () => stream.destroy());
    stream.pipe(res);
});

async function main() {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const context = await browser.newContext({
            viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
        });
        const page = await context.newPage();
        const errors = [], requests = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => requests.push(request.url()));
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        assert(!requests.some(url => url.includes('/fixation-panels/') && url.endsWith('.mp4')),
            'Below-fold fixation videos must not download on initial navigation');
        assert(!requests.some(url => url.includes('/web-posters/posters/gaze_probs')),
            'Far-offscreen posters must stay deferred');
        console.log('PASS: initial video/poster loading is selective');

        for (const width of [320, 390, 768, 1440]) {
            await page.setViewportSize({ width, height: 844 });
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
                `Page overflow at ${width}px`);
            assert(await page.locator('.results-thumbnail img').evaluateAll(images =>
                images.every(image => {
                    const rect = image.getBoundingClientRect();
                    return Math.abs(rect.width / rect.height - 16 / 9) < .04;
                })), `Thumbnail aspect ratio at ${width}px`);
        }
        console.log('PASS: responsive page and unstretched thumbnails at four viewport widths');
        await page.setViewportSize({ width: 390, height: 844 });

        await page.route('**/data/distractor_comparisons/tape_012.mp4*', async route => {
            await new Promise(resolve => setTimeout(resolve, 2000));
            await route.continue().catch(() => {}); // Navigation can cancel this request.
        });
        const carousel = page.locator('.carousel-container').filter({ has: page.locator('.distractor-comparison') });
        await carousel.scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        await carousel.locator('.carousel-button--right').click();
        await page.waitForFunction(() => {
            const video = document.querySelector('.distractor-comparison').closest('.carousel-container')
                .querySelector('.current-slide video');
            return video.readyState >= 3 && !video.paused;
        });
        await page.waitForTimeout(2300);
        const playing = await carousel.locator('.carousel-slide').evaluateAll(slides =>
            slides.filter(slide => [...slide.querySelectorAll('video')].some(video => !video.paused))
                .map(slide => slide.classList.contains('current-slide')));
        assert.deepEqual(playing, [true], 'Only the selected slide may play after a late response');
        assert(await carousel.locator('.current-slide video').evaluate(video => !video.currentSrc.startsWith('blob:')));
        console.log('PASS: delayed previous slide cannot steal playback; videos stream without blobs');

        await page.evaluate(() => {
            Object.defineProperty(document, 'hidden', { value: true, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
        });
        assert(await carousel.locator('video').evaluateAll(videos => videos.every(video => video.paused)));
        await page.evaluate(() => {
            delete document.hidden;
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await page.waitForFunction(() => !document.querySelector('.distractor-comparison')
            .closest('.carousel-container').querySelector('.current-slide video').paused);
        console.log('PASS: page visibility pauses and restores eligible playback');

        const selected = carousel.locator('.current-slide');
        await selected.locator('.distractor-play-toggle').click();
        assert(await selected.locator('video').evaluate(video => video.paused));
        await selected.locator('.distractor-scrubber').evaluate(input => {
            input.value = '500';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.waitForTimeout(300);
        assert(await selected.locator('video').evaluate(video => Math.abs(video.currentTime / video.duration - .5) < .1));
        await selected.locator('.distractor-play-toggle').click();
        await page.waitForFunction(() => !document.querySelector('.distractor-comparison')
            .closest('.carousel-container').querySelector('.current-slide video').paused);
        for (let i = 0; i < 5; i++) await carousel.locator('.carousel-button--right').click();
        await page.waitForTimeout(1500);
        assert(await carousel.locator('video').evaluateAll(videos => videos.filter(video =>
            video.hasAttribute('src') || video.querySelector('source[src]')).length <= 2));
        console.log('PASS: seeking, pause/resume, rapid navigation, and two-slide loading bound');

        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(11000);
        assert(await carousel.locator('video').evaluateAll(videos =>
            videos.every(video => video.paused && !video.querySelector('source[src]'))));
        console.log('PASS: distant carousel media releases its sources and buffers');

        const fixation = page.locator('.fixation-panels');
        await fixation.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => [...document.querySelectorAll('.fixation-slide[aria-hidden="false"] video')]
            .every(video => !video.paused && video.readyState >= 3));
        await fixation.locator('.fixation-next').click();
        await page.waitForFunction(() => [...document.querySelectorAll('.fixation-slide[aria-hidden="false"] video')]
            .every(video => !video.paused && video.readyState >= 3));
        assert(await fixation.locator('.fixation-slide[aria-hidden="true"] video')
            .evaluateAll(videos => videos.every(video => video.paused)));
        console.log('PASS: fixation pairs load on demand and switch together');
        assert.deepEqual(errors, []);
        await context.close();

        // An unavailable source must produce actionable feedback and recover.
        const recovery = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        const rp = await recovery.newPage();
        let fail = true;
        await rp.route('**/data/distractor_comparisons/tape_012.mp4*', route =>
            fail ? route.fulfill({ status: 503, body: 'Temporarily unavailable' }) : route.continue());
        await rp.goto(base, { waitUntil: 'domcontentloaded' });
        const rc = rp.locator('.carousel-container').filter({ has: rp.locator('.distractor-comparison') });
        await rc.scrollIntoViewIfNeeded();
        await rc.locator('.media-feedback button', { hasText: 'Retry' }).waitFor({ state: 'visible' });
        fail = false;
        await rc.locator('.media-feedback button').click();
        await rp.waitForFunction(() => {
            const video = document.querySelector('.distractor-comparison video');
            return !video.paused && video.readyState >= 3 && video.currentTime > 0;
        });
        console.log('PASS: failed download offers Retry and recovers');
        await recovery.close();

        // Emulate browser autoplay rejection, then allow a user-initiated retry.
        const blocked = await browser.newContext();
        await blocked.addInitScript(() => {
            const play = HTMLMediaElement.prototype.play;
            window.allowPlayback = false;
            HTMLMediaElement.prototype.play = function () {
                return window.allowPlayback ? play.call(this) :
                    Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError'));
            };
        });
        const bp = await blocked.newPage();
        await bp.goto(base, { waitUntil: 'domcontentloaded' });
        const bc = bp.locator('.carousel-container').filter({ has: bp.locator('.distractor-comparison') });
        await bc.scrollIntoViewIfNeeded();
        await bc.locator('.media-feedback button', { hasText: 'Play' }).waitFor({ state: 'visible' });
        await bp.evaluate(() => { window.allowPlayback = true; });
        await bc.locator('.media-feedback button').click();
        await bp.waitForFunction(() => {
            const video = document.querySelector('.distractor-comparison video');
            return !video.paused && video.readyState >= 3 && video.currentTime > 0;
        });
        console.log('PASS: autoplay rejection offers Play and recovers');
        await blocked.close();
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
}
module.exports = { server };
if (require.main === module) {
    main().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
}
