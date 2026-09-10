"""Create web video derivatives; never modify the source videos.

Run from anywhere: python3 scripts/optimize_site_media.py
Requires ffmpeg (libx264 and libsvtav1) and ffprobe. Outputs and provenance
are stored in data/web-video/. Existing matching outputs are reused.
"""

import concurrent.futures
import hashlib
import json
from fractions import Fraction
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data/web-video"
SETTINGS = "1080-high-quality-30fps-v1"


def digest(path):
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def prefer_smaller_source(result):
    """Already compact <=1080p/30fps sources only need their metadata moved."""
    source, target = ROOT / result["source"], ROOT / result["output"]
    if target.stat().st_size > source.stat().st_size:
        video = json.loads(subprocess.check_output([
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=height,avg_frame_rate", "-of", "json", str(source)
        ]))["streams"][0]
        if video["height"] <= 1080 and Fraction(video["avg_frame_rate"]) <= 30:
            temporary = target.with_suffix(".remuxing.mp4")
            subprocess.run([
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
                "-map", "0", "-c", "copy", "-movflags", "+faststart", str(temporary)
            ], check=True)
            temporary.replace(target)
            result["mode"] = "lossless faststart remux"
            result["web_bytes"] = target.stat().st_size
            target.with_suffix(".json").write_text(json.dumps(result, indent=2) + "\n")
    return result


def encode(source):
    relative = source.relative_to(ROOT / "data")
    target = OUTPUT / relative
    record = target.with_suffix(".json")
    source_hash = digest(source)
    if target.exists() and record.exists():
        previous = json.loads(record.read_text())
        if previous["source_sha256"] == source_hash and previous["settings"] == SETTINGS:
            return prefer_smaller_source(previous)

    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(".encoding.mp4")
    streams = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_streams", "-of", "json", str(source)
    ]))["streams"]
    video = next(stream for stream in streams if stream["codec_type"] == "video")
    av1 = video["codec_name"] == "av1"
    # Keep 1080 vertical pixels and the source aspect ratio. Never upscale.
    filters = "scale=-2:'min(1080,ih)':flags=lanczos,fps=30"
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-threads", "4", "-i", str(source), "-map", "0:v:0", "-map", "0:a?",
        "-vf", filters, "-c:a", "copy",
    ]
    if av1:
        command += [
            "-c:v", "libsvtav1", "-preset", "6", "-crf", "24",
            "-svtav1-params", "lp=4", "-pix_fmt", "yuv420p10le",
        ]
    else:
        command += [
            "-c:v", "libx264", "-preset", "slow", "-crf", "20",
            "-threads", "4", "-pix_fmt", "yuv420p",
        ]
    command += ["-g", "60", "-movflags", "+faststart", str(temporary)]
    subprocess.run(command, check=True)
    temporary.replace(target)
    result = {
        "source": str(source.relative_to(ROOT)),
        "output": str(target.relative_to(ROOT)),
        "source_sha256": source_hash,
        "settings": SETTINGS,
        "original_bytes": source.stat().st_size,
        "web_bytes": target.stat().st_size,
    }
    result = prefer_smaller_source(result)
    record.write_text(json.dumps(result, indent=2) + "\n")
    print(f"{relative}: {result['original_bytes'] / 1e6:.1f} → "
          f"{result['web_bytes'] / 1e6:.1f} MB", flush=True)
    return result


def main():
    sources = sorted((ROOT / "data").glob("policy_*.mp4"))
    sources += sorted((ROOT / "data").glob("gaze_probs_*.mp4"))
    sources += [ROOT / "data/teaser.mp4", ROOT / "data/er2_success_scroll.mp4"]
    sources += sorted((ROOT / "data/results-sdr").glob("result_*.mp4"))
    sources += sorted((ROOT / "data/results-av1").glob("result_*.mp4"))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(encode, sources))
    (OUTPUT / "manifest.json").write_text(json.dumps(results, indent=2) + "\n")
    original = sum(item["original_bytes"] for item in results)
    optimized = sum(item["web_bytes"] for item in results)
    print(f"Total: {original / 1e6:.1f} → {optimized / 1e6:.1f} MB; "
          f"saved {100 * (1 - optimized / original):.1f}%. Originals untouched.")


if __name__ == "__main__":
    main()
