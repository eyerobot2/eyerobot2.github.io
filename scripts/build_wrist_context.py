"""Render timestamp-matched exo insets into the intro's wrist videos."""
import json
import subprocess
from pathlib import Path
import h5py
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
RECORDINGS = Path.home() / 'eyeball/recordings'
OUT = ROOT / 'data/camera-comparisons'
TAKES = {
    'boba': 'archive/exo+wrist/exo_wrist_ee_boba_eval [FINAL]/episode_001',
    'pot': 'exo+wrist/exo_wrist_pot_reeval/episode_004',
}
FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
TASK_LABELS = {'boba': 'Insert straw into cup', 'pot': 'Place lid on pot'}
for task, take in TAKES.items():
    folder = RECORDINGS / take
    names = ['wrist_left', 'wrist_right', 'left']
    times, readers, indices, current = {}, {}, {}, {}
    sizes = {'wrist_left': (480, 360), 'wrist_right': (480, 360), 'left': (224, 168)}
    for name in names:
        with h5py.File(folder / f'{name}_ts.h5') as f:
            times[name] = f['timestamps'][:]
        w, h = sizes[name]
        readers[name] = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', str(folder / f'{name}.mp4'), '-vf', f'scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], stdout=subprocess.PIPE)
        indices[name] = -1
    path = OUT / f'{task}-intro-wrists-context.mp4'
    encoder = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '960x360', '-r', '30', '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(path)], stdin=subprocess.PIPE)
    mappings = []
    # Stop at the shortest camera's capture interval; nearest-neighbor matching.
    start = max(ts[0] for ts in times.values())
    end = min(ts[-1] for ts in times.values())
    try:
        for timestamp in times['wrist_left']:
            if not start <= timestamp <= end:
                continue
            row = {}
            for name in names:
                target = int(np.argmin(abs(times[name] - timestamp)))
                w, h = sizes[name]
                while indices[name] < target:
                    raw = readers[name].stdout.read(w * h * 3)
                    if len(raw) != w * h * 3:
                        raise RuntimeError(f'{task}/{name}: incomplete frame')
                    current[name] = Image.frombytes('RGB', (w, h), raw)
                    indices[name] += 1
                row[name] = target
            image = Image.new('RGB', (960, 360))
            image.paste(current['wrist_left'], (0, 0))
            image.paste(current['wrist_right'], (480, 0))
            draw = ImageDraw.Draw(image)
            draw.rectangle((6, 182, 233, 353), fill='white')
            image.paste(current['left'], (8, 184))
            label = TASK_LABELS[task]
            label_width = draw.textbbox((0, 0), label, font=FONT)[2]
            draw.rectangle((8, 184, 18 + label_width, 203), fill='#263640')
            draw.text((13, 185), label, fill='white', font=FONT)
            encoder.stdin.write(image.tobytes())
            if not mappings:
                image.save(OUT / f'{task}-intro-wrists-context.webp', quality=90)
            mappings.append(row)
    finally:
        encoder.stdin.close()
        for reader in readers.values():
            reader.kill()
            reader.stdout.close()
            reader.wait()
    if encoder.wait() != 0:
        raise RuntimeError('Video encoding failed')
    (OUT / f'{task}-intro-wrists-context.json').write_text(json.dumps({
        'source_directory': str(folder), 'fps': 30, 'dimensions': [960, 360],
        'inset': {'x': 8, 'y': 184, 'width': 224, 'height': 168, 'label': TASK_LABELS[task]},
        'alignment': 'Nearest capture timestamp to left wrist; shared capture interval only.',
        'frames': mappings,
    }, indent=2) + '\n')
    print(task, len(mappings), path.stat().st_size, flush=True)
