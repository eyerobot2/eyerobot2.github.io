"""Build the unified results data and static SVG fallbacks from existing results.

Camera counts/progression are the accepted evaluation snapshot; simulation and
ablation rates come from the existing SVG/source data, with their stated averages
preserved. Distractor values retain the paper's exact fractions.
"""
import importlib.util
import json
from html import escape
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
METHODS = [dict(key='passive', label='Passive stereo', color='#7fc0a3'),
           dict(key='wrist', label='Ego + Wrist', color='#5c8fc5'),
           dict(key='er', label='EyeRobot 2.0', color='#f2986f', hatch=True)]
SUCCESS = 'Success rate is the percentage of trials that complete the full task.'
PROGRESSION = 'Task progression is the average percentage of task stages completed in order.'

def module(path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def metric(key, label, title, caption):
    return dict(key=key, label=label, title=title, caption=caption)

def svg(chart):
    # Desktop fallback: same spacing/palette as the responsive renderer.
    w, h = (540, 240) if chart.get('compact') else (760, 275)
    base, top = h-35, 32
    rows, methods = chart['rows'], chart['methods']
    space = (w-64)/len(rows)
    bw = min(70 if len(rows)==1 else 36, space*.73/len(methods))
    key = chart['defaultMetric']; selected = next(m for m in chart['metrics'] if m['key']==key)
    parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title desc">',
        f'<title id="title">{escape(selected["title"])}</title>',
        '<desc id="desc">'+escape('; '.join(row['label']+': '+', '.join(m['label']+' '+str(row['values'][key][m['key']])+'%' for m in methods) for row in rows))+'</desc>',
        '<defs><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#f2986f"/><path d="M0 0V7" stroke="#fff" stroke-width="1"/></pattern></defs>',
        '<style>text{font-family:"Avenir Next",Avenir,"Open Sans",sans-serif;fill:#555;font-size:13px}.tick{fill:#8c9093;font-size:11px}.value{fill:#333;font-size:11px}.grid{stroke:#e8ebed;stroke-width:1}</style>']
    for v in [0,25,50,75,100]:
        y=base-(base-top)*v/100
        parts.append(f'<line class="grid" x1="42" x2="{w-12}" y1="{y}" y2="{y}"/><text class="tick" x="34" y="{y+4}" text-anchor="end">{v}{"%" if v==100 else ""}</text>')
    for i,row in enumerate(rows):
        center=48+space*(i+.5)
        for j,m in enumerate(methods):
            value=row['values'][key][m['key']]; height=(base-top)*value/100
            x=center+(j-(len(methods)-1)/2)*(bw+2)
            label=f'{value:.1f}' if row.get('decimals') else str(int(value+.5))
            fill='url(#hatch)' if m.get('hatch') else m['color']
            parts.append(f'<rect x="{x-bw/2}" y="{base-height}" width="{bw}" height="{height}" rx="1" fill="{fill}"/><text class="value" x="{x}" y="{base-height-8}" text-anchor="middle">{label}</text>')
        parts.append(f'<text x="{center}" y="{base+26}" text-anchor="middle">{escape(row["label"])}</text>')
    return '\n'.join(parts+['</svg>'])+'\n'

def main():
    camera=json.loads((ROOT/'data/camera-comparisons/results.json').read_text())
    charts={}
    for key,group,methodkeys,title in [('camera-passive',None,['passive','er'],'Average task success'),('camera-clear','clear',['wrist','er'],'Success with unobstructed wrist views'),('camera-occluded','occluded',['passive','wrist','er'],'Success under tool occlusion')]:
        rows=[]
        if group is None:
            vals={metric:{m['key']:sum(t['results'][m['key']][field] for t in camera['tasks'])/7 for m in METHODS} for metric,field in [('success','percent'),('progression','progression')]}
            rows=[dict(key='average',label='All seven tasks',values=vals)]
        else:
            for t in camera['tasks']:
                if t['group']==group:
                    rows.append(dict(key=t['key'],label=t['name'],values={metric:{m['key']:t['results'][m['key']][field] for m in METHODS} for metric,field in [('success','percent'),('progression','progression')]}))
        trials=' Mean across seven equally weighted tasks. 25 trials per task and policy; 64 for tape.' if group is None else ' 25 trials per task and policy.'
        ptitle='Average task progression' if group is None else title.replace('Success','Task progression')
        charts[key]=dict(methods=[m for m in METHODS if m['key'] in methodkeys],rows=rows,defaultMetric='success',compact=group is None,
            metrics=[metric('success','Success rate',title,SUCCESS+trials),metric('progression','Task progression',ptitle,PROGRESSION+trials)])
    tree=ET.parse(ROOT/'images/figure_sim.svg');ns={'s':'http://www.w3.org/2000/svg'}
    rects=sorted([r for r in tree.findall('.//s:rect',ns) if r.attrib.get('width')=='18'],key=lambda r:float(r.attrib['x']))
    assert len(rects)==21
    simrows=[]
    for i,(key,label) in enumerate([('average','Average'),('tape','Tape'),('pot','Pot lid'),('tiger','Tiger'),('tray','Medical tray'),('plate','Plate in rack'),('spoon','Hang spoon')]):
        simrows.append(dict(key=key,label=label,values={'success':{m['key']:round(float(rects[i*3+j].attrib['height'])/1.44,6) for j,m in enumerate(METHODS)}}))
    charts['simulation']=dict(methods=METHODS,rows=simrows,defaultMetric='success',metrics=[metric('success','Success rate','Simulation task success',SUCCESS+' 1,800 simulation trials.')])
    ablation=module(ROOT/'scripts/generate_action_ablation_chart.py')
    rows=[dict(key=label.lower(),label=label.capitalize() if label in ['tape','pot','tiger','tray','plate','spoon'] else label,description=task,decimals=1 if label=='Average' else 0,values={'success':{'world':world,'er':full}}) for label,task,full,world,_ in ablation.DATA]
    charts['action-ablation']=dict(methods=[dict(key='world',label='World-relative actions',color='#5c8fc5'),METHODS[2]],rows=rows,defaultMetric='success',metrics=[metric('success','Success rate','Fixation-relative action ablation',SUCCESS)])
    distractor=module(ROOT/'scripts/generate_distractor_charts.py');values=distractor.values();policies=['Exo (Stereo)','Ego + Wrist','AVF'];rows=[]
    for key,label in [('average','Average'),('wrench','Wrench'),('tea','Tea'),('tape','Tape')]:
        vals={metric:{m['key']:float(sum(values[t,policy][metric] for t in ['wrench','tea','tape'])/3 if key=='average' else values[key,policy][metric]) for m,policy in zip(METHODS,policies)} for metric in ['progression','grasp','success']}
        rows.append(dict(key=key,label=label,values=vals))
    charts['distractors']=dict(methods=METHODS,rows=rows,defaultMetric='progression',metrics=[
        metric('progression','Task progression','Task progression with distractors','Mean percentage of task stages completed. 25 trials per task bar.'),
        metric('grasp','First grasp','First-grasp success with distractors','Percentage of trials completing the first grasp. 25 trials per task bar.'),
        metric('success','Full-task success','Task success with distractors','Percentage of trials completing the full task. 25 trials per task bar.')])
    (ROOT/'data/results-charts.json').write_text(json.dumps(charts,indent=2)+'\n')
    (ROOT/'images/results').mkdir(exist_ok=True)
    for key,chart in charts.items():(ROOT/f'images/results/{key}.svg').write_text(svg(chart))
    print('Built six chart configurations and matching SVG fallbacks without changing result values.')

if __name__=='__main__':main()
