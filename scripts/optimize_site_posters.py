"""Generate compact posters/thumbnails without replacing the JPEG originals."""
from pathlib import Path
from io import BytesIO
import subprocess
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def main():
    sources = sorted((ROOT / "data/posters").rglob("*.jpg"))
    sources += sorted((ROOT / "data/fixation-panels").glob("*.jpg"))
    original = optimized = 0
    for source in sources:
        relative = source.relative_to(ROOT / "data")
        target = ROOT / "data/web-posters" / relative.with_suffix(".webp")
        target.parent.mkdir(parents=True, exist_ok=True)
        # Match the trimmed web rollouts rather than the untrimmed JPEG masters.
        video = ROOT / "data/web-video" / (
            "results-sdr" if source.stem.startswith("result_") else ""
        ) / (source.stem + ".mp4")
        poster_source = source
        if source.stem.startswith(("result_", "policy_")) and video.exists():
            poster_source = BytesIO(subprocess.check_output([
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(video),
                "-frames:v", "1", "-f", "image2pipe", "-c:v", "png", "-"
            ]))
        with Image.open(poster_source) as image:
            image.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
            image.save(target, "WEBP", quality=85, method=6)
        original += source.stat().st_size
        optimized += target.stat().st_size
        if source.name.startswith("result_"):
            thumbnail = ROOT / "data/web-posters/thumbnails" / source.with_suffix(".webp").name
            thumbnail.parent.mkdir(parents=True, exist_ok=True)
            if isinstance(poster_source, BytesIO):
                poster_source.seek(0)
            with Image.open(poster_source) as image:
                image.thumbnail((240, 240), Image.Resampling.LANCZOS)
                image.save(thumbnail, "WEBP", quality=82, method=6)
    print(f"Posters: {original / 1e6:.2f} → {optimized / 1e6:.2f} MB. Originals untouched.")
    # A real first frame avoids an empty teaser before its video is ready.
    frame = subprocess.check_output([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(ROOT / "data/teaser.mp4"),
        "-frames:v", "1", "-vf", "scale=1280:-2", "-f", "image2pipe", "-c:v", "png", "-"
    ])
    with Image.open(BytesIO(frame)) as image:
        image.save(ROOT / "data/web-posters/teaser.webp", "WEBP", quality=85, method=6)


if __name__ == "__main__":
    main()
