#!/usr/bin/env python3
"""Add timestamp-aligned, left-eye second-tier gaze insets to distractor comparisons.

Requires numpy, torch, OpenCV, Pillow, ffmpeg and the eyeball repository on
PYTHONPATH (eye.elp_equirect / eye.stereo). Supply raw episode directories via
--recordings. Writes to a separate --output directory; never overwrites inputs.
Use --rebuild-base when selecting existing website comparisons: this rebuilds
both policy views from raw recordings, preventing already baked wrist overlays
from being composited again. Otherwise source comparisons must be overlay-free.
Optional --wrist-overlays adds timestamp-aligned wrist views to the baseline.
Optional --timestamps accepts exported {task}_{trial}_ts.npy files instead of
reading left_ts.h5 with h5py. Geometry follows scripts/replay_demo.py: logged
azimuth/elevation and depth, per-eye vergence, calibrated ELP projection.
"""
import argparse
import hashlib
import json
import math
import subprocess
from concurrent.futures import ThreadPoolExecutor
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


WRIST_TASKS = {'tape': 'tape_exo_wrist', 'tea': 'exo wrist hero tea', 'wrench': 'wrench_exo_wrist'}


def read_timestamps(episode, filename, args, export_name):
    if args.timestamps:
        return np.load(args.timestamps / f'{export_name}_ts.npy')
    import h5py
    with h5py.File(episode / filename) as handle:
        return handle['timestamps'][:]


def card_image(width, height, label, font_path):
    image = Image.new('RGB', (width, height), (251, 251, 249))
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, width-1, height-1), outline=(198, 203, 200), width=1)
    draw.text((9, height-27), label, font=ImageFont.truetype(str(font_path), 21), fill=(65, 73, 70))
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def dotted_footprint(overlay, map_x, map_y, raw_width, raw_height, grey=132, opacity=235):
    """Trace each projected crop edge; space neutral-grey dots by screen distance.

    Invalid rays are skipped instead of joining across the -2 sentinel region.
    Keeping the lens distortion means the footprint can have curved edges.
    """
    for mx, my in [(map_x[0], map_y[0]), (map_x[-1], map_y[-1]),
                   (map_x[:, 0], map_y[:, 0]), (map_x[:, -1], map_y[:, -1])]:
        previous = None
        remaining = 0.0
        for rx, ry in zip(mx, my):
            if not (0 <= rx < raw_width and 0 <= ry < raw_height):
                previous = None
                remaining = 0.0
                continue
            point = np.array([800 + rx * 800 / raw_width, ry * 600 / raw_height])
            if previous is None:
                cv2.circle(overlay, tuple(np.rint(point).astype(int)), 1, (grey, grey, grey, opacity), -1, cv2.LINE_AA)
            else:
                delta = point - previous
                length = np.linalg.norm(delta)
                if length < 30:  # Never bridge a projection discontinuity.
                    offset = 7.0 - remaining
                    while offset <= length:
                        dot = previous + delta * offset / max(length, 1e-9)
                        cv2.circle(overlay, tuple(np.rint(dot).astype(int)), 1, (grey, grey, grey, opacity), -1, cv2.LINE_AA)
                        offset += 7.0
                    remaining = (remaining + length) % 7.0
                else:
                    remaining = 0.0
            previous = point


class WristViews:
    def __init__(self, task, trial, args):
        self.relative_episode = Path(task) / WRIST_TASKS[task] / f'episode_{trial}'
        self.episode = args.recordings / self.relative_episode
        key = f'{task}_{trial}'
        self.times = read_timestamps(self.episode, 'left_ts.h5', args, key + '_wrist_policy_left')
        self.streams = []
        # Right-align the pair within the baseline's 800-pixel-wide panel.
        pair_right = 800 - MARGIN
        for side, label, x in [('left', 'Wrist L', pair_right-2*CARD_W-12),
                               ('right', 'Wrist R', pair_right-CARD_W)]:
            times = read_timestamps(self.episode, f'wrist_{side}_ts.h5', args, key + '_wrist_' + side)
            assert np.all(np.diff(times) > 0)
            cap = cv2.VideoCapture(str(self.episode / f'wrist_{side}.mp4'))
            assert int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) == len(times)
            height = int(round(SIZE * cap.get(4) / cap.get(3)))
            self.streams.append(dict(side=side, times=times, cap=cap, index=-1, frame=None,
                height=height, card=card_image(CARD_W, height+32, label, args.font), x=x,
                selected=[], deltas=[]))

    def draw(self, overlay, frame_index):
        timestamp = self.times[min(frame_index, len(self.times)-1)]
        for stream in self.streams:
            times = stream['times']
            hi = min(int(np.searchsorted(times, timestamp)), len(times)-1)
            lo = max(0, hi-1)
            idx = lo if abs(times[lo]-timestamp) <= abs(times[hi]-timestamp) else hi
            assert idx >= stream['index']
            while stream['index'] < idx:
                ok, stream['frame'] = stream['cap'].read()
                assert ok, f"Missing {stream['side']} wrist frame {idx}"
                stream['index'] += 1
            image = stream['card'].copy()
            image[2:2+stream['height'], 2:2+SIZE] = cv2.resize(stream['frame'], (SIZE, stream['height']), interpolation=cv2.INTER_AREA)
            x, y = stream['x'], MARGIN
            overlay[y:y+image.shape[0], x:x+image.shape[1], :3] = image
            overlay[y:y+image.shape[0], x:x+image.shape[1], 3] = 255
            stream['selected'].append(idx)
            stream['deltas'].append(float(times[idx]-timestamp))

    def finish(self):
        result = {'episode': str(self.relative_episode), 'timing': 'Nearest wrist exposure to the baseline left-camera exposure; hold final frame at stream end.', 'streams': []}
        for stream in self.streams:
            stream['cap'].release()
            deltas = np.array(stream['deltas'])
            result['streams'].append({'side': stream['side'], 'x': stream['x'], 'y': MARGIN,
                'width': CARD_W, 'height': stream['height']+32,
                'frames': len(stream['times']), 'selected_frames': stream['selected'],
                'median_absolute_offset_s': float(np.median(abs(deltas))),
                'max_absolute_offset_s': float(max(abs(deltas)))})
        return result


def rebuild_base(source, args):
    """Use only the source filename to select the trial; never its encoded pixels."""
    task, trial = source.stem.split('_')
    wrist = args.recordings / task / WRIST_TASKS[task] / f'episode_{trial}' / 'left.mp4'
    eye = args.recordings / task / TASKS[task] / f'episode_{trial}' / 'left.mp4'
    folder = args.output / 'base'
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / source.name
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
        '-i', str(wrist), '-i', str(eye), '-filter_complex',
        '[0:v]scale=800:600:flags=lanczos,setsar=1,setpts=PTS-STARTPTS[w];'
        '[1:v]scale=800:600:flags=lanczos,setsar=1,setpts=PTS-STARTPTS[e];'
        '[w][e]hstack=inputs=2:shortest=0[v]', '-map', '[v]', '-an',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-threads', '4',
        '-pix_fmt', 'yuv420p', '-g', '30', '-keyint_min', '30',
        '-sc_threshold', '0', '-movflags', '+faststart', str(target)], check=True)
    print(f'{source.stem}: rebuilt both policy views from raw cameras', flush=True)
    return target


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
    # Trace all three recorded crop scales; keep the inset itself at tier 2.
    crop_fovs = [2 * math.atan(crop / (2 * meta['training_camera_K'][0][0]))
                 for crop in meta['crop_sizes']]
    assert len(crop_fovs) == 3
    tier_rays = {}
    for tier in (0, 2):
        tier_focal = SIZE / 2 / math.tan(crop_fovs[tier] / 2)
        directions = torch.tensor(np.stack([(x-SIZE/2)/tier_focal,
                    (y-SIZE/2)/tier_focal, np.ones_like(x)], -1), dtype=torch.float32)
        tier_rays[tier] = directions / directions.norm(dim=-1, keepdim=True)
    eyes = np.column_stack([np.interp(timestamps, state['timestamps'], state['eye_state'][:, j])
                            for j in range(2)])
    depths = np.interp(timestamps, state['timestamps'], state['fixation_depth'])
    base = cv2.VideoCapture(str(source))
    raw = cv2.VideoCapture(str(episode / 'left.mp4'))
    baseline_path = args.recordings / task / WRIST_TASKS[task] / f'episode_{trial}' / 'left.mp4'
    baseline_raw = cv2.VideoCapture(str(baseline_path))
    baseline_count = int(baseline_raw.get(cv2.CAP_PROP_FRAME_COUNT))
    assert baseline_count > 0
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
        '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', f'{width}x{height}',
        '-r', str(fps), '-i', 'pipe:0',
        '-filter_complex', '[0:v][1:v]overlay=x=0:y=0:shortest=1[v]',
        '-map', '[v]', '-an', '-c:v', 'libx264',
        '-preset', 'slow', '-crf', '20', '-threads', '4', '-pix_fmt', 'yuv420p',
        '-g', '30', '-keyint_min', '30', '-sc_threshold', '0', '-movflags', '+faststart', str(output)
    ], stdin=subprocess.PIPE, stderr=log)
    outside_errors, coverages = [], []
    left, top = width - CARD_W - MARGIN, MARGIN
    reference_indices = {0, min(100, len(timestamps)-1), len(timestamps)-1}
    last_frame = None
    wrists = WristViews(task, trial, args) if args.wrist_overlays else None
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
            baseline_raw.set(cv2.CAP_PROP_POS_FRAMES, min(i, baseline_count-1))
            ok, baseline_frame = baseline_raw.read()
            assert ok
            baseline_reference = cv2.resize(baseline_frame, (800, 600), interpolation=cv2.INTER_AREA)
            delta = baseline_reference.astype(float) - frame[:, :800].astype(float)
            baseline_error = float(np.sqrt(np.mean(delta**2)))
            top_error = float(np.sqrt(np.mean(delta[:300]**2)))
            assert baseline_error < 6 and top_error < 6, (
                f'{source}: baseline is not a clean raw-camera view at frame {i} '
                f'(RMS {baseline_error:.2f}, upper half {top_error:.2f}). '
                'Existing wrist overlays may be baked in; use --rebuild-base.')
            outside_errors.append({'frame': i, 'raw_to_comparison_rms': error,
                'baseline_raw_to_comparison_rms': baseline_error, 'baseline_top_half_rms': top_error})
        composed = sampling_grid(grid, rays, eyes[j], depths[j], meta['stereo_baseline'])
        map_x = ((composed[:, :, 0] + 1) * last_frame.shape[1] - 1) / 2
        map_y = ((composed[:, :, 1] + 1) * last_frame.shape[0] - 1) / 2
        inset = cv2.remap(last_frame, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        coverages.append(float(((composed >= -1) & (composed <= 1)).all(-1).mean()))
        inset_card = card.copy()
        inset_card[2:2+SIZE, 2:2+SIZE] = inset
        overlay = np.zeros((height, width, 4), dtype=np.uint8)
        for tier in (2, 0):
            tier_grid = sampling_grid(grid, tier_rays[tier], eyes[j], depths[j], meta['stereo_baseline'])
            tier_x = ((tier_grid[:, :, 0]+1)*last_frame.shape[1]-1)/2
            tier_y = ((tier_grid[:, :, 1]+1)*last_frame.shape[0]-1)/2
            dotted_footprint(overlay, tier_x, tier_y, last_frame.shape[1], last_frame.shape[0],
                             grey=165, opacity=220)
        dotted_footprint(overlay, map_x, map_y, last_frame.shape[1], last_frame.shape[0])
        overlay[top:top+CARD_H, left:left+CARD_W, :3] = inset_card
        overlay[top:top+CARD_H, left:left+CARD_W, 3] = 255
        if wrists:
            wrists.draw(overlay, i)
        encoder.stdin.write(overlay.tobytes())
        if i == 0 or i in reference_indices:
            alpha = overlay[:, :, 3:4].astype(np.float32) / 255
            frame = np.rint(frame * (1-alpha) + overlay[:, :, :3] * alpha).astype(np.uint8)
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
    baseline_raw.release()
    record = {
        'video': source.name, 'episode': f'{task}/{TASKS[task]}/episode_{trial}',
        'source_sha256': sha(source), 'raw_left_sha256': sha(episode/'left.mp4'),
        'raw_baseline_sha256': sha(baseline_path),
        'state_sha256': sha(episode/'state.npz'), 'output_sha256': sha(output),
        'duplicate_state_timestamps': duplicate_count, 'frames': count, 'raw_frames': len(timestamps), 'fps': fps,
        'inset': {'eye': 'left', 'crop_level': 1, 'fov_degrees': math.degrees(fov),
                  'x': left, 'y': top, 'width': CARD_W, 'height': CARD_H},
        'footprint': 'Three dotted neutral-grey crop outlines projected into the raw camera image; middle tier darker; 7-pixel dot spacing. Portions outside camera coverage are omitted.',
        'footprint_fovs_degrees': [math.degrees(angle) for angle in crop_fovs],
        'wrist_overlays': wrists.finish() if wrists else None,
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
    parser.add_argument('--rebuild-base', action='store_true', help='Rebuild selected comparison trials from raw camera recordings before compositing.')
    parser.add_argument('--wrist-overlays', action='store_true', help='Add left/right wrist insets to the baseline policy.')
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
    sources = sorted(args.source.glob('*.mp4'))
    if args.rebuild_base:
        with ThreadPoolExecutor(max_workers=2) as pool:
            sources = list(pool.map(lambda source: rebuild_base(source, args), sources))
    records = [render(p, args, grid, card) for p in sources]
    provenance = {
        'description': 'Left-eye second-tier gaze view and three dotted foveation crop footprints reconstructed from logged gaze and calibrated raw RGB.',
        'timing': 'Raw video frame index matches the existing comparison. Eye angles and depth are linearly interpolated at left_ts.h5 exposure timestamps; duplicate state timestamps retain the last update; state endpoints and shorter videos hold their last sample.',
        'projection': 'Same equirectangular-coordinate composition as replay_demo._project_pinhole_pair; CPU cv2.remap for the final bilinear color sample. No smoothing or target corrections.',
        'clips': records,
    }
    (args.output / 'gaze-provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')


if __name__ == '__main__':
    main()
