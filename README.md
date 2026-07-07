# eyerobot2-website

Project page for **[PAPER SHORT TITLE]**. Static site (no build step) adapted from the
[eyerobot-website](https://github.com/kerrj/eyerobot-website) / RSRD template.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The whole page. Edit placeholders here (search for `[` and `TODO`). |
| `style.css` | Design system, copied verbatim from eyerobot-website. |
| `script.js` | jQuery helpers from the original template. The live carousels are driven by the inline script at the bottom of `index.html`; `script.js` only contains legacy object-viewer helpers (safe to trim/delete). |
| `data/` | All media (videos, figures, favicon, preview card). Currently **empty** — drop assets here. |

## Filling in the template

Everything to replace is marked one of two ways:

- **`[SQUARE BRACKETS]`** — text to swap (title, authors, venue, captions, bibtex).
- **`TODO` comments** — where a real media file should be dropped into `data/`.

Quick way to find them all:

```bash
grep -n "TODO\|\[" index.html
```

Media filenames the page currently expects (rename in `index.html` or match these):
`data/teaser.mp4`, `data/framework.jpg`, `data/result_1.mp4` … `result_3.mp4`,
`data/method.mp4`, `data/before.mp4`, `data/after.mp4`,
`data/section_left.mp4`, `data/section_right.mp4`, `data/favicon.webp`, `data/previewcard.jpg`.

Until a file exists, dashed **placeholder boxes** (`.media-placeholder`) show where the teaser
and framework figure go; videos simply stay blank. Remove the placeholder `<div>`s once real
media is in.

To add a carousel slide: copy a `.carousel-slide` block **and** add one more
`<button class="carousel-indicator" data-slide="N"></button>` to that carousel's `.carousel-nav`.

## Local preview

```bash
cd ~/eyerobot2-website && python -m http.server 8000
```

Then open <http://localhost:8000>.

## Deploying (GitHub Pages)

1. Push to a GitHub repo (see below).
2. Repo **Settings → Pages → Build from branch**, pick the branch + `/ (root)`.
3. For a custom domain, add a `CNAME` file containing just the domain (e.g. `www.example.net`)
   and point your DNS at GitHub Pages. (Intentionally omitted here — no domain chosen yet.)

## Git

This repo is initialized locally but **not committed** — commits and pushes are done by the
repo owner only.
