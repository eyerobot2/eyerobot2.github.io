/* Browser checks for the main-page action figure. Uses the media test server. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { server } = require('./test_media.cjs');

async function main() {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
        const requests = [], errors = [];
        page.on('request', r => requests.push(r.url()));
        page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => {
            window.actionDraws = 0;
            const clear = CanvasRenderingContext2D.prototype.clearRect;
            CanvasRenderingContext2D.prototype.clearRect = function (...args) {
                if (this.canvas.closest('[data-fixation-actions]')) window.actionDraws++;
                return clear.apply(this, args);
            };
        });
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(300);
        assert(!requests.some(url => url.includes('tape-pick-widget.json')), 'Pose data must load near the figure only');
        const widget = page.locator('[data-fixation-actions]');
        assert.equal(await widget.locator('details,select,input').count(), 0);
        await widget.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => document.querySelector('[data-fixation-actions]').dataset.state === 'ready');
        const payload = await (await page.request.get(`${base}/data/fixation-actions/tape-pick-widget.json`)).json();
        assert.deepEqual(payload.window, [.25, 1]);
        assert.equal(payload.pose_count, 2015);
        assert.equal(payload.endpoints.length, 64);
        assert(!requests.some(url => /left-cloud|gripper-preview|frames\.json/.test(url)), 'Only display data is requested');
        const snapshots = () => widget.locator('canvas').evaluateAll(cs => cs.map(c => c.toDataURL()));
        const initial = await snapshots();
        await page.waitForTimeout(250);
        assert((await snapshots()).every((v, i) => v !== initial[i]), 'Both cameras sway');
        await widget.locator('canvas').first().focus();
        const focused = await snapshots();
        await page.waitForTimeout(250);
        assert((await snapshots()).every((v, i) => v !== focused[i]), 'Focus does not stop sway');
        const box = await widget.locator('canvas').first().boundingBox();
        await page.mouse.move(box.x + 100, box.y + 100);
        await page.mouse.down();
        const held = await snapshots(), count = await page.evaluate(() => window.actionDraws);
        await page.waitForTimeout(200);
        assert.deepEqual(await snapshots(), held);
        assert.equal(await page.evaluate(() => window.actionDraws), count, 'Sway pauses during dragging');
        await page.mouse.move(box.x + 160, box.y + 120);
        const dragged = await snapshots();
        assert(dragged.every((v, i) => v !== held[i]), 'Drag controls both cameras');
        await page.mouse.up();
        await page.waitForTimeout(200);
        assert((await snapshots()).every((v, i) => v !== dragged[i]), 'Sway resumes after dragging');
        await widget.locator('.rgb-frame').nth(1).hover();
        const hovered = await snapshots();
        await page.waitForTimeout(200);
        assert((await snapshots()).every((v, i) => v !== hovered[i]), 'RGB hover does not stop sway');
        await page.mouse.move(0, 0);
        // Freeze motion for exact camera and highlight comparisons below.
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForTimeout(100);
        const stopped = await snapshots();
        await page.keyboard.press('ArrowRight');
        assert((await snapshots()).every((v, i) => v !== stopped[i]), 'Camera controls remain linked');
        await page.keyboard.press('0');
        const beforeHighlight = await snapshots();
        await widget.locator('.rgb-frame').nth(1).hover();
        assert((await snapshots()).every((v, i) => v !== beforeHighlight[i]), 'RGB highlight updates both views');
        await page.mouse.move(0, 0);
        assert.deepEqual(await snapshots(), beforeHighlight);
        await widget.locator('canvas').first().evaluate(el => el.blur());
        await page.waitForFunction(() => [...document.querySelectorAll('.fixation-actions img')].every(i => i.complete && i.naturalWidth));
        await widget.screenshot({ path: '/tmp/fixation-actions-main.png' });
        assert.equal(await widget.locator('h4').first().evaluate(el => getComputedStyle(el).textAlign), 'center');
        assert.equal(await widget.locator('figcaption').evaluate(el => getComputedStyle(el).textAlign), 'left');
        for (const width of [320, 390, 768]) {
            await page.setViewportSize({ width, height: 844 });
            await widget.scrollIntoViewIfNeeded();
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No page overflow at ${width}px`);
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await widget.screenshot({ path: '/tmp/fixation-actions-main-mobile.png' });
        assert.deepEqual(errors, []);
        console.log('PASS: lazy loading, fixed defaults, persistent sway, drag pause/resume, shared camera, RGB highlights, responsive layout');

        const reduced = await browser.newPage({ reducedMotion: 'reduce' });
        await reduced.goto(`${base}/fixation-actions-preview.html`);
        await reduced.waitForFunction(() => document.querySelector('[data-fixation-actions]').dataset.state === 'ready');
        const preview = reduced.locator('[data-fixation-actions]');
        await reduced.waitForTimeout(100);
        const still = await preview.locator('canvas').evaluateAll(cs => cs.map(c => c.toDataURL()));
        await reduced.waitForTimeout(200);
        assert.deepEqual(await preview.locator('canvas').evaluateAll(cs => cs.map(c => c.toDataURL())), still);
        assert.equal(await reduced.locator('details,select,input').count(), 0);
        console.log('PASS: shared mockup component, settings removed, reduced-motion view stays static');
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
}

main().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
