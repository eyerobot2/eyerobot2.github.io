#!/usr/bin/env python3
"""Add timestamp-aligned, left-eye second-tier gaze insets to distractor comparisons.

Requires numpy, torch, OpenCV, Pillow, ffmpeg and the eyeball repository on
PYTHONPATH (eye.elp_equirect / eye.stereo). Supply raw episode directories via
--recordings. Writes to a separate --output directory; never overwrites inputs.
Optional --timestamps accepts exported {task}_{trial}_ts.npy files instead of
reading left_ts.h5 with h5py. Geometry follows scripts/replay_demo.py: logged
azimuth/elevation and depth, per-eye vergence, calibrated ELP projection.
"""
import argparse
import hashlib
import json
import math
import subprocess
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image, ImageDraw, ImageFont
from eye.elp_equirect import ELPToEquirect
from eye.stereo import compute_fixation_point, fixation_to_eye_so3s

TASKS = {'tape': 'tape_eyeball', 'tea': 'eyeball_tea', 'wrench': 'wrench_eyeball'}
SIZE = 228
CARD_W, CARD_H, MARGIN = SIZE + 4, SIZE + 32, 14


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sampling_grid(grid, rays, eye, depth, baseline):
    fixation = compute_fixation_point(torch.tensor(eye[None], dtype=torch.float32),
                                     torch.tensor([depth], dtype=torch.float32))
    rotation = fixation_to_eye_so3s(fixation, baseline=baseline)[0].as_matrix()[0]
    x, y, z = (rays @ rotation.T).unbind(-1)
    coords = torch.stack([torch.atan2(-y, x) / math.pi,
                          2 * torch.atan2(torch.hypot(x, y), z) / math.pi - 1], -1)[None]
    return torch.nn.functional.grid_sample(
        grid, coords, mode='nearest', padding_mode='zeros', align_corners=True
    )[0].permute(1, 2, 0).numpy()


def render(source, args, grid, card):
    task, trial = source.stem.split('_')
    episode = args.recordings / task / TASKS[task] / f'episode_{trial}'
    meta = json.loads((episode / 'meta.json').read_text())
    state = np.load(episode / 'state.npz', allow_pickle=False)
    if args.timestamps:
        timestamps = np.load(args.timestamps / f'{source.stem}_ts.npy')
    else:
        import h5py
        with h5py.File(episode / 'left_ts.h5') as handle:
            timestamps = handle['timestamps'][:]
    assert np.all(np.diff(timestamps) > 0)
    assert np.all(np.diff(state['timestamps']) >= 0)
    # Two recordings repeat a state timestamp; retain the last logged update.
    keep = np.r_[np.diff(state['timestamps']) != 0, True]
    duplicate_count = int((~keep).sum())
    state = {key: state[key][keep] for key in ('timestamps', 'eye_state', 'fixation_depth')}
    # Match the second tier of the recorded policy's crop pyramid.
    fov = 2 * math.atan(meta['crop_sizes'][1] / (2 * meta['training_camera_K'][0][0]))
    focal = SIZE / 2 / math.tan(fov / 2)
    x, y = np.meshgrid(np.arange(SIZE) + .5, np.arange(SIZE) + .5)
    rays = torch.tensor(np.stack([(x - SIZE / 2) / focal,
                                  (y - SIZE / 2) / focal, np.ones_like(x)], -1), dtype=torch.float32)
    rays /= rays.norm(dim=-1, keepdim=True)
    eyes = np.column_stack([np.interp(timestamps, state['timestamps'], state['eye_state'][:, j])
                            for j in range(2)])
    depths = np.interp(timestamps, state['timestamps'], state['fixation_depth'])
    base = cv2.VideoCapture(str(source))
    raw = cv2.VideoCapture(str(episode / 'left.mp4'))
    width, height, count = (int(base.get(k)) for k in (3, 4, 7))
    fps = base.get(5)
    assert (width, height, fps) == (1600, 600, 30)
    assert int(raw.get(7)) == len(timestamps)
    assert raw.get(5) == fps
    output = args.output / source.name
    assert output.resolve() != source.resolve()
    log = (args.output / f'{source.stem}.log').open('w')
    encoder = subprocess.Popen([
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
        '-i', str(source),
        '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{CARD_W}x{CARD_H}',
        '-r', str(fps), '-i', 'pipe:0',
        '-filter_complex', f'[0:v][1:v]overlay=x={width-CARD_W-MARGIN}:y={MARGIN}:shortest=1[v]',
        '-map', '[v]', '-an', '-c:v', 'libx264',
        '-preset', 'slow', '-crf', '20', '-threads', '4', '-pix_fmt', 'yuv420p',
        '-g', '30', '-keyint_min', '30', '-sc_threshold', '0', '-movflags', '+faststart', str(output)
    ], stdin=subprocess.PIPE, stderr=log)
    outside_errors, coverages = [], []
    left, top = width - CARD_W - MARGIN, MARGIN
    reference_indices = {0, min(100, len(timestamps)-1), len(timestamps)-1}
    last_frame = None
    for i in range(count):
        ok, frame = base.read()
        if not ok:
            raise RuntimeError(f'{source}: missing comparison frame {i}')
        if i < len(timestamps):
            ok, last_frame = raw.read()
            if not ok:
                raise RuntimeError(f'{episode}: missing raw frame {i}')
        j = min(i, len(timestamps)-1)  # match held final frame in the comparison
        if i in reference_indices:
            diff = cv2.resize(last_frame, (800, 600)).astype(float) - frame[:, 800:].astype(float)
            error = float(np.sqrt(np.mean(diff**2)))
            assert error < 6, f'{source}: raw frame {i} does not align (RMS {error})'
            outside_errors.append({'frame': i, 'raw_to_comparison_rms': error})
        composed = sampling_grid(grid, rays, eyes[j], depths[j], meta['stereo_baseline'])
        map_x = ((composed[:, :, 0] + 1) * last_frame.shape[1] - 1) / 2
        map_y = ((composed[:, :, 1] + 1) * last_frame.shape[0] - 1) / 2
        inset = cv2.remap(last_frame, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        coverages.append(float(((composed >= -1) & (composed <= 1)).all(-1).mean()))
        inset_card = card.copy()
        inset_card[2:2+SIZE, 2:2+SIZE] = inset
        frame[top:top+CARD_H, left:left+CARD_W] = inset_card
        encoder.stdin.write(inset_card.tobytes())
        if i == 0:
            Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).resize((960, 360), Image.Resampling.LANCZOS).save(
                args.output / f'{source.stem}.webp', quality=85, method=6)
        if i in reference_indices:
            cv2.imwrite(str(args.output / f'{source.stem}-{i}.jpg'), frame)
    encoder.stdin.close()
    assert encoder.wait() == 0, f'ffmpeg failed: see {source.stem}.log'
    log.close()
    base.release()
    raw.release()
    record = {
        'video': source.name, 'episode': f'{task}/{TASKS[task]}/episode_{trial}',
        'source_sha256': sha(source), 'raw_left_sha256': sha(episode/'left.mp4'),
        'state_sha256': sha(episode/'state.npz'), 'output_sha256': sha(output),
        'duplicate_state_timestamps': duplicate_count, 'frames': count, 'raw_frames': len(timestamps), 'fps': fps,
        'inset': {'eye': 'left', 'crop_level': 1, 'fov_degrees': math.degrees(fov),
                  'x': left, 'y': top, 'width': CARD_W, 'height': CARD_H},
        'alignment': outside_errors, 'minimum_valid_fraction': min(coverages),
        'bytes_before': source.stat().st_size, 'bytes_after': output.stat().st_size,
    }
    (args.output / f'{source.stem}.json').write_text(json.dumps(record, indent=2) + '\n')
    print(f'{source.stem}: {count} frames, {output.stat().st_size/1e6:.2f} MB', flush=True)
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--recordings', type=Path, required=True)
    parser.add_argument('--source', type=Path, default=Path('data/distractor_comparisons'))
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--timestamps', type=Path)
    parser.add_argument('--font', type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    torch.set_num_threads(2)
    converter = ELPToEquirect.from_stereo_config('left', out_w=2561, out_h=1281, device='cpu')
    grid = converter._grid.permute(0, 3, 1, 2).contiguous()
    card = Image.new('RGB', (CARD_W, CARD_H), (251, 251, 249))
    draw = ImageDraw.Draw(card)
    draw.rectangle((0, 0, CARD_W-1, CARD_H-1), outline=(198, 203, 200), width=1)
    draw.text((9, SIZE+5), 'Gaze', font=ImageFont.truetype(str(args.font), 21), fill=(65, 73, 70))
    card = cv2.cvtColor(np.array(card), cv2.COLOR_RGB2BGR)
    records = [render(p, args, grid, card) for p in sorted(args.source.glob('*.mp4'))]
    provenance = {
        'description': 'Left-eye second-tier gaze view reconstructed from logged gaze and calibrated raw RGB.',
        'timing': 'Raw video frame index matches the existing comparison. Eye angles and depth are linearly interpolated at left_ts.h5 exposure timestamps; duplicate state timestamps retain the last update; state endpoints and shorter videos hold their last sample.',
        'projection': 'Same equirectangular-coordinate composition as replay_demo._project_pinhole_pair; CPU cv2.remap for the final bilinear color sample. No smoothing or target corrections.',
        'clips': records,
    }
    (args.output / 'gaze-provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')


if __name__ == '__main__':
    main()
