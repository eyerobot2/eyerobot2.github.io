# Project-page media

The original videos and JPEG posters remain at their original paths. The page
uses separate derivatives in `data/web-video/` and `data/web-posters/`.
`data/web-video/manifest.json` records source paths, SHA-256 checksums, and sizes.

## Regeneration

```sh
python3 scripts/optimize_site_media.py
python3 scripts/optimize_site_posters.py
```

These require FFmpeg/ffprobe (libx264 and libsvtav1) and Python Pillow.
Existing matching video derivatives are reused. Originals are never overwritten.
New video output is written to a temporary file before replacing a derivative.
Update the page's URLs only after the output files exist.

- Video encodes use 30 fps and at most 1080 vertical pixels, preserving aspect
  ratios without upscaling. The 2160×1080 policy videos retain their dimensions;
  2160×1620 composites become 1440×1080; 1600×900 results stay 1600×900.
- Results retain a 10-bit AV1 version and an H.264 fallback. Audio is preserved.
- MP4 metadata is placed at the front for progressive playback and seeking.
  Already-small sources at or below 1080p/30 fps use a lossless remux if
  re-encoding would increase file size.
- WebP posters fit within 1280×1280; filmstrip thumbnails fit within 240×240.
  Their original JPEGs remain available.

## Loading and playback

`media.js` owns source attachment, streaming, feedback, and playback intent.
`carousels.js` and `fixation-panels.js` own navigation and select the active
slide through that shared controller.

Keep deferred URLs in `data-src` / `data-poster`. Supply intrinsic dimensions
and responsive CSS (`height: auto`) so unloaded media retains its shape.
Below-fold figures use native lazy loading and asynchronous image decoding.

The controller prepares the active slide within 400 pixels of the viewport,
plays it only while visible, and waits until playback starts before preparing
the next slide's metadata. Prewarming is disabled for Save-Data and 2G
connections. Only the selected and next slides retain video sources; after
10 seconds far offscreen, the whole carousel releases its sources and buffers.
The browser may still retain its own HTTP cache.

Comparison clips use direct URLs, not complete-file blobs. GitHub Pages byte
range support was checked with a real request (`206 Partial Content`).
Loading, Play, and Retry feedback cover buffering, autoplay rejection, and
network errors. Fixation pairs start together after both have data.

## Browser regression checks

Install test tooling outside the site, then run:

```sh
npm install --prefix /tmp/eyerobot-media-tests playwright
NODE_PATH=/tmp/eyerobot-media-tests/node_modules node scripts/test_media.cjs
```

The tests use installed Google Chrome and a temporary localhost server with
byte-range support. They cover delayed responses, rapid navigation, seeking,
pause/resume, visibility, source eviction, paired fixation playback, failed
downloads, autoplay rejection, mobile overflow, and thumbnail aspect ratios.
The tests do not publish or alter media.

## Validation (September 10, 2026)

- All 30 derivatives passed resolution, frame-rate, and fast-start checks.
  Every source-video checksum matched its manifest entry.
- The derivative set totals 228.8 MB versus 544.9 MB of sources (58% smaller).
  This includes both alternative result codecs; it is not an initial-page payload.
- A cold Chrome mobile simulation (390×844, 4 Mbps, 100 ms latency, 4× CPU
  throttling), sampled 12 seconds after DOMContentLoaded, made 62 requests
  versus 105 in the earlier audit. Only the teaser requested video data,
  compared with seven initial video requests before the change.
- The final snapshot transferred approximately 1.74 MB and reported no HTTP
  or JavaScript errors. First contentful paint was approximately 1.01 seconds.
  These are local lab observations, not real-device or production guarantees.
- Actual playback was checked for the new AV1 results, H.264 policy clips,
  gaze-probability clips, paired fixation panels, and simulation pairs.
- Mobile/desktop screenshots and layout assertions verified the filmstrip
  images retain their 16:9 shape after adding intrinsic dimensions.
