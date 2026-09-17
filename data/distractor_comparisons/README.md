# Distractor comparison videos

Each video pairs the original left-camera recordings for the same task and trial:
Ego + Wrist on the left, eyerobot 2.0 on the right. Recording starts are aligned;
the shorter trial holds its final frame.

The baseline has two timestamp-aligned wrist insets in its upper-right corner.
The eyerobot view has a second-tier gaze inset and three dotted grey foveation
footprints. The middle footprint is darker to match the inset. Portions outside
the physical camera's field of view are omitted.

## Regeneration

Always rebuild the camera pair from raw recordings when selecting published
videos. Earlier published versions already contained wrist insets, so using
those encoded pixels as the base would duplicate overlays.

With the eyeball repository on `PYTHONPATH` and the renderer's dependencies:

```sh
python scripts/render_distractor_gaze.py \
  --recordings /path/to/distractors \
  --source data/distractor_comparisons \
  --output /tmp/distractor-render \
  --font /path/to/font.ttf \
  --rebuild-base --wrist-overlays
```

With `--rebuild-base`, `--source` supplies trial filenames only. Both camera
views are rebuilt from the original episode `left.mp4` files. The renderer
checks both policy views against raw frames, including the baseline's upper
half where old wrist overlays were present.

The output directory contains MP4s, WebP posters, intermediate base videos,
diagnostic frames, and `gaze-provenance.json`. After review, copy only the final
MP4s here, posters into `data/web-posters/posters/distractor_comparisons`, and
refresh the content hashes in `index.html`. Preserve the calibration provenance
when updating `gaze-provenance.json`.

## Selected examples on the website

`selected-examples.json` records the twelve reviewed examples, their per-video
captions, and asset hashes. The page groups them into Tape (five), Tea (four),
and Wrench (three). These examples include successful retries and failures;
captions describe the individual recordings rather than asserting frequencies.

Unselected earlier videos remain available for the local review gallery. New
selected assets were copied unchanged from the reviewed Figure Lab renders;
`gaze-provenance.json` retains the provenance of the original main-site set.

Outcome badges in both distractor carousels use the per-policy `outcomes` entries in `selected-examples.json`. These record each stage from the corresponding raw episode’s `eval_events.csv`, its relative path, and SHA-256. Success requires all task stages to be complete. Badges show the final task outcome throughout playback, and are HTML overlays rather than re-encoded video pixels.
