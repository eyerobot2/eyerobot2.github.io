"""Prepare the fixed 25–100% tape-pick figure from the audited pose export."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "data/fixation-actions"


def build():
    data = json.loads((ASSETS / "tape-pick-left-cloud.json").read_text())
    examples = json.loads((ASSETS / "frames.json").read_text())
    windows = {e["episode"]: e["window_s"] for e in data["episodes"]}
    indices = []
    episodes = {}
    for i, sample in enumerate(data["samples"]):
        start, end = windows[sample["episode"]]
        if start + .25 * (end - start) <= sample["time_s"] <= end:
            episodes.setdefault(sample["episode"], []).append(len(indices))
            indices.append(i)
    world = [data["world_poses"][i] for i in indices]
    fixation = [data["poses"][i] for i in indices]
    centers = [
        [(min(p[k] for p in poses) + max(p[k] for p in poses)) / 2 for k in range(3)]
        for poses in (world, fixation)
    ]
    radius = max(
        math.dist(p[:3], center)
        for poses, center in zip((world, fixation), centers) for p in poses
    ) + .04
    origins = [data["camera_origins_fixation"][i] for i in indices]
    mean = [sum(p[k] for p in origins) / len(origins) for k in range(3)]
    camera_index = indices[min(range(len(origins)), key=lambda i: math.dist(origins[i], mean))]
    a = data["poses"][camera_index][3:]
    b = data["camera_poses"][camera_index][3:]
    result = {
        "window": [.25, 1],
        "trial_count": len(episodes),
        "pose_count": len(indices),
        "world": world,
        "fixation": fixation,
        "endpoints": [
            max(ids, key=lambda i: data["samples"][indices[i]]["time_s"])
            for ids in episodes.values()
        ],
        "centers": centers,
        "radius": radius,
        "camera": {
            "position": data["camera_origins_fixation"][camera_index],
            "rotation": [
                sum(a[row * 3 + k] * b[col * 3 + k] for k in range(3))
                for row in range(3) for col in range(3)
            ],
            "sample": data["samples"][camera_index],
        },
        "examples": {
            "world": [data["world_poses"][e["source_index"]] for e in examples],
            "fixation": [data["poses"][e["source_index"]] for e in examples],
        },
    }
    target = ASSETS / "tape-pick-widget.json"
    target.write_text(json.dumps(result, separators=(",", ":")) + "\n")
    print(f"{target.name}: {len(indices)} poses, {len(episodes)} trials, {target.stat().st_size:,} bytes")


if __name__ == "__main__":
    build()
