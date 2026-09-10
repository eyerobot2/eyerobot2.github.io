#!/usr/bin/env python3
"""Export standalone paired panels for the main site's 2x5 comparison."""
import argparse
import json
from pathlib import Path
import random
import subprocess
import tempfile

import numpy as np
from PIL import Image


PANELS = [
    ("pick-tape", "tape", "count-128"),
    ("place-tape", "tape-place", "place/count-128"),
    ("pick-tea", "pick-tea", "tea/pick_tea/count-128"),
    ("place-tea", "place-tea", "tea/carry_tea/count-128"),
    ("wrench", "wrench", "wrench/count-128"),
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", type=Path, default=Path("/tmp/fixation-state-video-frames"))
    parser.add_argument("--output", type=Path, default=Path("data/fixation-panels"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    base = Path(__file__).resolve().parents[1]/"data/fixation-cloud"
    order = list(range(128))
    random.Random(7).shuffle(order)
    panels = []
    for name, cache, folder in PANELS:
        manifest = json.loads((base/folder/"manifest.json").read_text())
        records = [(r["episode"], s) for r in manifest["records"] for s in r["samples"]]
        assert sorted(s["pool_rank"] for _, s in records) == list(range(128))
        indices = np.argsort([s["pool_rank"] for _, s in records])[order]
        with np.load(args.cache/f"{cache}.npz") as stored:
            arrays = {mode: stored[mode][indices] for mode in ("raw", "fixation")}
        with tempfile.TemporaryDirectory(prefix=f"fixation-panel-{name}-") as temporary:
            frames = Path(temporary)
            for i in range(128):
                # The two views share one encoded frame, so they cannot drift.
                canvas = Image.new("RGB", (256, 464), "white")
                canvas.paste(Image.fromarray(arrays["raw"][i]).crop((0, 32, 256, 224)), (0, 0))
                canvas.paste(Image.fromarray(arrays["fixation"][i]), (0, 208))
                canvas.save(frames/f"frame_{i:03d}.png")
                if i == 0:
                    canvas.save(args.output/f"{name}.jpg", quality=95)
            common = ["ffmpeg", "-v", "error", "-y", "-framerate", "12",
                      "-i", str(frames/"frame_%03d.png")]
            subprocess.run(common + [
                "-frames:v", "128", "-an", "-c:v", "libx264", "-preset", "medium",
                "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                str(args.output/f"{name}.mp4"),
            ], check=True)
            subprocess.run(common + [
                "-filter_complex",
                "[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a",
                "-loop", "0", str(args.output/f"{name}.gif"),
            ], check=True)
        panels.append(dict(
            panel=name, source_manifest=f"data/fixation-cloud/{folder}/manifest.json",
            ordered_frames=[dict(episode=records[i][0], source_frame=records[i][1]["source_frame"])
                            for i in indices],
        ))
        print(f"Exported {name}: paired GIF + 12-fps MP4", flush=True)
    (args.output/"provenance.json").write_text(json.dumps(dict(
        fps=12, samples=128, shuffle_seed=7, original_frame_indices=order, panels=panels,
        layout=dict(width=256, height=464, raw=[0, 0, 256, 192], fixation=[0, 208, 256, 256]),
        method="Same approved stage samples and per-frame local contrast as the 128-frame study. "
               "Same seeded shuffle A. Each encoded frame contains both views of one exposure. "
               "Raw camera padding removed; no camera content cropped. Wrench uses whole rollouts.",
        gif_timing="GIF timing rounds frame durations to centiseconds; MP4 preserves exact 12 fps.",
    ), indent=2)+"\n")


if __name__ == "__main__":
    main()
