"""Regenerate SDR rollouts from the HLG masters; requires FFmpeg with zscale.
Usage: python3 scripts/render_results_sdr.py --ffmpeg /path/to/ffmpeg
"""
import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--ffmpeg', default='ffmpeg')
parser.add_argument('--av1', action='store_true',
                    help='also emit 10-bit AV1 into data/results-av1 (smaller, '
                         'better gradients; H.264 stays as the fallback source)')
parser.add_argument('--av1-crf', type=int, default=24)
parser.add_argument('--av1-preset', type=int, default=4)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
# Linear float processing avoids intermediate integer clipping. A fixed peak
# prevents frame-to-frame exposure pumping; preserve saturation in the toolbox.
# The HLG masters are 8-bit, so the tonemap redistributes an already-coarse
# ramp (a 256-step ramp survives as 186 distinct levels) and the quantisation
# reads as contour banding. Debanding in 10-bit before the final quantise
# removes it; grain synthesis was measured and not needed.
filters = ('zscale=t=linear:npl=600,format=gbrpf32le,zscale=p=bt709,'
           'tonemap=tonemap=mobius:desat=0:peak=1.667,'
           'zscale=t=bt709:m=bt709:r=tv:dither=error_diffusion,'
           'format=yuv420p10le,'
           'deband=1thr=0.03:2thr=0.03:3thr=0.03:range=32:blur=1')
backup = Path(tempfile.mkdtemp(prefix='eyerobot-sdr-backup-'))
print(f'Previous SDR files backed up to {backup}', flush=True)
for source in sorted((root / 'data/results-hlg').glob('result_*.mp4')):
    dest = root / 'data/results-sdr' / source.name
    if dest.exists():
        shutil.copy2(dest, backup / dest.name)
    temp = dest.with_name(dest.stem + '.rendering.mp4')
    subprocess.run([args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-y',
                    '-i', str(source), '-map', '0:v:0', '-an', '-vf', filters + ',format=yuv420p',
                    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
                    '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709',
                    '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
                    '-movflags', '+faststart', str(temp)], check=True)
    temp.replace(dest)
    print(f'Rendered {dest.name}', flush=True)

    if not args.av1:
        continue
    # 10-bit AV1 companion. The extra bit depth is the point: it clears the
    # banding that 8-bit leaves in the tonemapped sky/wall gradients, which
    # more H.264 bitrate does not fix.
    av1_dest = root / 'data/results-av1' / source.name
    av1_dest.parent.mkdir(parents=True, exist_ok=True)
    av1_temp = av1_dest.with_name(av1_dest.stem + '.rendering.mp4')
    subprocess.run([args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-y',
                    '-i', str(source), '-map', '0:v:0', '-an',
                    '-vf', filters,
                    '-c:v', 'libsvtav1', '-preset', str(args.av1_preset),
                    '-crf', str(args.av1_crf), '-pix_fmt', 'yuv420p10le',
                    '-color_primaries', 'bt709', '-color_trc', 'bt709',
                    '-colorspace', 'bt709', '-color_range', 'tv',
                    '-movflags', '+faststart', str(av1_temp)], check=True)
    av1_temp.replace(av1_dest)
    print(f'Rendered av1/{av1_dest.name}', flush=True)
