"""Refresh data/posters/<name>.jpg from the matching videos.
Usage: python3 scripts/generate_posters.py data/policy_*.mp4 [--ffmpeg /path/to/ffmpeg]
"""
import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('videos', nargs='+', type=Path)
parser.add_argument('--ffmpeg', default='ffmpeg')
parser.add_argument('--quality', type=int, default=4)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
backup = Path(tempfile.mkdtemp(prefix='eyerobot-poster-backup-'))
print(f'Previous posters backed up to {backup}', flush=True)
for video in args.videos:
    # Frame 0 at native resolution, so the poster matches the paused first
    # frame and nothing shifts once the video loads.
    poster = root / 'data/posters' / (video.stem + '.jpg')
    if poster.exists():
        shutil.copy2(poster, backup / poster.name)
    temp = poster.with_name(poster.stem + '.rendering.jpg')
    subprocess.run([args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-y',
                    '-i', str(video), '-frames:v', '1',
                    '-q:v', str(args.quality), str(temp)], check=True)
    temp.replace(poster)
    print(f'Poster {poster.name}', flush=True)
