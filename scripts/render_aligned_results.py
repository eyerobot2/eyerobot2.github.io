"""Render paired robot/stereo clips from manually selected movement anchors.

Source videos stay intact. Pairs start after their configured anchors and
end at the last shared frame; no freeze padding. --task limits regeneration.
HLG sources require a build with zscale, supplied through FFMPEG if needed.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import argparse,hashlib,json,math,os,subprocess
import cv2
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/results-gaze'
SPEC=json.loads((OUT/'alignment.json').read_text())
FFMPEG=os.environ.get('FFMPEG','ffmpeg')
# Same HLG → SDR recipe as render_results_sdr.py, retaining 10-bit processing.
HLG_FILTERS=('zscale=t=linear:npl=600,format=gbrpf32le,zscale=p=bt709,'
 'tonemap=tonemap=mobius:desat=0:peak=1.667,'
 'zscale=t=bt709:m=bt709:r=tv:dither=error_diffusion,format=yuv420p10le,'
 'deband=1thr=0.03:2thr=0.03:3thr=0.03:range=32:blur=1,scale=1600:900:flags=lanczos,')
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def info(path):
 return json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=duration,nb_frames','-of','json',str(path)]))['streams'][0]
def encode(source,start,frames,target,av1=False,gaze=False,hdr=False):
 filters=(HLG_FILTERS if hdr else '')+('scale=1024:512:flags=lanczos,' if gaze else '')+'fps=30,setpts=PTS-STARTPTS'
 codec=['-c:v','libsvtav1','-preset','8','-crf','24','-svtav1-params','lp=2','-pix_fmt','yuv420p10le'] if av1 else ['-c:v','libx264','-preset','slow','-crf','20' if gaze else '18','-threads','2','-pix_fmt','yuv420p']
 subprocess.run([FFMPEG,'-hide_banner','-loglevel','error','-y','-threads','2','-ss',str(start),'-i',str(source),'-an','-vf',filters,'-frames:v',str(frames),*codec,'-g','30','-movflags','+faststart',str(target)],check=True,stderr=subprocess.PIPE)
def poster(path):
 c=cv2.VideoCapture(str(path));ok,f=c.read();c.release();assert ok,path
 im=Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB));im.save(path.with_suffix('.webp'),quality=88)
def render(row):
 task=row['task'];robot=ROOT/row['robot_source'];gaze=ROOT/row['gaze_source']
 lead=row.get('start_after_anchor_seconds',SPEC['start_after_anchor_seconds']);rs=row['robot_seconds']+lead;gs=row['gaze_seconds']+lead;hdr=row.get('robot_color')=='HLG'
 ri=info(robot);gi=info(gaze)
 frames=min(math.floor((float(ri['duration'])-rs)*30+0.02),int(gi['nb_frames'])-round(gs*30));assert frames>0
 paths={'robot':OUT/f'{task}-robot.mp4','robot_av1':OUT/f'{task}-robot-av1.mp4','stereo':OUT/f'{task}-stereo.mp4'}
 encode(robot,rs,frames,paths['robot'],hdr=hdr);encode(gaze,gs,frames,paths['stereo'],gaze=True)
 # Preserve the existing 10-bit AV1 path for gradients, starting from its original derivative.
 av1=robot if hdr else ROOT/row['robot_source'].replace('/results-sdr/','/results-av1/')
 encode(av1,rs,frames,paths['robot_av1'],av1=True,hdr=hdr)
 for k in ['robot','stereo']:poster(paths[k])
 for path in paths.values():assert int(info(path)['nb_frames'])==frames,path
 print(f'{task}: robot {rs:.3f}s, gaze {gs:.3f}s → {frames} frames ({frames/30:.3f}s)',flush=True)
 return {'task':task,'robot_start_seconds':rs,'gaze_start_seconds':gs,'frames':frames,'fps':30,'duration_seconds':frames/30,'sources':{'robot':row['robot_source'],'robot_av1':str(av1.relative_to(ROOT)),'gaze':row['gaze_source']},'source_sha256':{'robot':digest(robot),'robot_av1':digest(av1),'gaze':digest(gaze)},'output_sha256':{k:digest(p) for k,p in paths.items()},'grading':HLG_FILTERS if hdr else 'Already graded source; no additional color transform.','note':row.get('note','Aligned by user-marked movement onset.')}
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--task');args=parser.parse_args()
 selected=[r for r in SPEC['tasks'] if not args.task or r['task']==args.task]
 if not selected:parser.error('Unknown task')
 with ThreadPoolExecutor(max_workers=2) as pool:rows=list(pool.map(render,selected))
 if args.task:
  previous=json.loads((OUT/'provenance.json').read_text())['tasks']
  replacement={r['task']:r for r in rows};rows=[replacement.get(r['task'],r) for r in previous]
 (OUT/'provenance.json').write_text(json.dumps({'alignment':'alignment.json','processing':'Start after the configured manual anchor lead-in (15 frames; Tea 5 frames). Keep only shared duration at 30 fps. Stereo resized to 1024x512. No freeze padding.','tasks':rows},indent=2)+'\n')
