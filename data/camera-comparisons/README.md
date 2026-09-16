# Camera comparison results and selected clips

These production assets support the main website's staged camera comparisons.
There are no runtime dependencies on Figure Lab or the Eval Browser submodule.

`results.json` retains exact successes/trials, progression percentages, selected
examples, and section copy. Full-task success is the default. The average weights
each of the seven tasks equally. Marker, tea, toaster, and wrench form the clear
wrist-view group; boba and pot lid form the tool-occlusion group. Tape remains in
the overall average; the Eval Browser contains the full results. “Pot lid” uses `pot place`, not
the stricter `perfect pot place` criterion.

`progression-provenance.json` records the episode-source hashes and denominators
used to compute deepest consecutive stage reached / total funnel depth. All 21
per-task percentages match the preexisting `images/figure_real_progression.svg`.

Selected examples are marker 000, tea 002, toaster 000, wrench 000, boba 001, and
pot 004. Both policies succeed in the four clear-view examples. In the two
occlusion examples the wrist baseline fails and EyeRobot succeeds. These are
illustrative examples, not an estimate of typical outcomes; all trials remain
in the bar charts.

Each wrist MP4 combines left and right inputs side by side at 1280×480, ending
at the shorter input. Three pairs differ by one frame. EyeRobot clips keep the
640×320 stereo region and remove the bottom probability plot. Wrench already
had that layout and was copied without reencoding. Posters match these aspect
ratios. Clips preserve 30fps, use H.264 CRF20 with one-second keyframes and
faststart, and contain no audio. Cropped clip frame counts are unchanged.

`provenance.json` records source/output hashes, dimensions, frame counts, and
pixel checks against the source crop or concatenation. The original recordings
were not modified. Camera task selection uses the main SiteMedia loader, with
selected-tab reset, near-viewport preparation, offscreen pause, and bounded
buffer retention. Wrist views share one player; the two policies play independently.

The shared results renderer and styles are `results-charts.js` and
`results-charts.css`. The six chart configurations and no-JavaScript SVG fallbacks
are regenerated with:

```sh
python3 scripts/build_results_charts.py
```

This preserves the existing simulation average (54/75/74), action-ablation
average (52.5/74.3), exact distractor fractions, and all existing per-task values.
Each plot's metric controls update only that plot. Bars never animate. Narrow
plots wrap task groups into rows to retain readable labels and the same 0–100%
scale. The camera trial UI is independently scoped in `camera-comparisons.js`
and `camera-comparisons.css`.

Browser validation:

```sh
NODE_PATH=/tmp/eyerobot-media-tests/node_modules node scripts/test_results.cjs
NODE_PATH=/tmp/eyerobot-media-tests/node_modules node scripts/test_media.cjs
```
