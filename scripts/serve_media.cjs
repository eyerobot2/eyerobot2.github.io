/* Local preview with byte ranges so browser seeking behaves like production.
 * Run: node scripts/serve_media.cjs [port] (default: 8765).
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

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

module.exports = { server };
if (require.main === module) {
    const port = Number(process.argv[2] || 8765);
    server.on('error', error => { console.error(error.message); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => {
        console.log(`Media preview: http://127.0.0.1:${server.address().port} (byte ranges enabled)`);
    });
}
