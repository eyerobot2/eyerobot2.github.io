# Fixation-centric action figure

The main page and `fixation-actions-preview.html` share `fixation-actions.js`
and `fixation-actions.css`. The widget loads `tape-pick-widget.json` within
400 px of the viewport. The three WebP stills use native lazy loading.

The fixed selection is 25–100% of each previously segmented tape-pick window:
2,015 measured left-gripper poses from 64 trials. Positions are in meters;
rotations are row-major 3×3 matrices. Each fixation-relative pose uses the
gaze frame at its own timestamp: origin at the recorded fixation point,
world-up Z, and X along the horizontal gaze direction. These are recorded
proprioceptive poses, not predicted action chunks.

Each cloud has a fixed display center, with a shared metric scale and camera
orientation. The table uses z = −0.03175 m from the robot code; its extent is
illustrative. The small camera triad uses the actual recorded camera nearest
the mean camera position within the selection.

The RGB stills come from `episode_027`, at the beginning, middle, and end of
the earlier 25–90% selection. `frames.json` records their exact source video
frames and pose indices. No smoothing is applied.

The trajectories are static. Earlier glyphs use 20% opacity and the last
sample of each trial is bold. A small 20 fps camera sway persists after
interaction around the user's chosen angle, pauses during dragging,
suspends offscreen/in hidden tabs, and respects reduced
motion. Geometry is precomputed and drawn in six batched strokes per view.

Regenerate the compact payload from the audited pose export:

```sh
python3 scripts/build_fixation_action_widget.py
```

Only `tape-pick-widget.json` and `reach-{0,1,2}.webp` are loaded by the site.
The source export, mesh experiment, and correspondence metadata are not
requested during normal viewing.
