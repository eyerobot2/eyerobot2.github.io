/* Recorded stereo demonstration, frame 0. The existing spherical warp is preserved.
 * RH +X right, +Y down, +Z forward. Geometry is in baseline-relative units;
 * annotated tape centers estimate target rays, not measured scene reconstruction.
 * See images/simulated-gaze/provenance.json for source and coordinate details.
 */
(async () => {
  'use strict';
  const root = document.getElementById('gym-spatial');
  if (!root) return;
  const assetBase=new URL('images/simulated-gaze/',document.currentScript.src);
  const $ = id => root.querySelector(`#gym-spatial-${id}`);
  const scene = $('scene'), ctx = scene.getContext('2d');
  const status = $('status');
  const cameras = Object.freeze([Object.freeze([-.9, 0, 0]), Object.freeze([.9, 0, 0])]);
  // Matched tape-hole centers in the fixed pinhole previews (pixels).
  // Average vertical annotation; stereo disparity determines depth / baseline.
  const centers = [[[505,725],[420,725]], [[749,704],[660,704]]];
  const SW = 1200, SH = 900, SF = 450;
  const targets = centers.map(pair => {
    const z=1.8*SF/(pair[0][0]-pair[1][0]);
    return [-.9+(pair[0][0]-SW/2)*z/SF, ((pair[0][1]+pair[1][1])/2-SH/2)*z/SF, z];
  });
  const names = ['Yellow tape', 'Grey tape'];
  // Compact the illustrative table layout without changing the recorded
  // target directions used for stereo sampling.
  const tableCenterX=(targets[0][0]+targets[1][0])/2;
  const tablePosition=p=>[tableCenterX+(p[0]-tableCenterX)*.55,p[1],p[2]];
  const MW = 2562, MH = 1282, OW = 360, OH = 270;
  const FOV = 36;
  const VF = OW / (2 * Math.tan(FOV * Math.PI / 360));
  const RADIUS = .92;
  const C = { ink:'#333', muted:'#75808a', line:'#dce2e6', blue:'#91afc6', mint:'#80b397', peach:'#f5c6aa' };
  const add = (a,b) => a.map((x,i) => x+b[i]);
  const sub = (a,b) => a.map((x,i) => x-b[i]);
  const mul = (a,s) => a.map(x => x*s);
  const dot = (a,b) => a.reduce((s,x,i) => s+x*b[i],0);
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit = a => mul(a,1/Math.hypot(...a));
  const basis = direction => {
    const z = unit(direction), x = unit(cross([0,1,0],z));
    return [x,cross(z,x),z];
  };
  const rotate = (b,r) => add(add(mul(b[0],r[0]),mul(b[1],r[1])),mul(b[2],r[2]));
  // Schematic front view: the robot's left is the reader's right. Apply this
  // convention to every projected point, including image patches and gaze rays,
  // rather than swapping eye labels or altering the recorded image coordinates.
  // Depth compression is illustrative; the drawing is not a calibrated viewer.
  const project = p => {
    const depth=4+p[2];
    return [300-490*p[0]/depth,85+490*p[1]/depth];
  };
  const canvas = (w,h) => Object.assign(document.createElement('canvas'),{width:w,height:h});
  async function image(name) {
    const im=new Image(); im.src=new URL(`${name}.webp`,assetBase).href; await im.decode(); return im;
  }
  // The main page is long: decode the panoramas only as this figure approaches.
  await new Promise(resolve=>{
    const loader=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){loader.disconnect();resolve();}
    },{rootMargin:'500px 0px'});
    loader.observe(root);
  });
  let images;
  try {
    images=await Promise.all(['left-view','right-view','left-spherical','right-spherical'].map(image));
  } catch(error) {
    status.textContent='The stereo sample could not load. Reload to try again.';
    root.dataset.loadError='true'; console.error(error); return;
  }
  const sources=images.slice(0,2).map(im=>({canvas:im}));
  const maps=images.slice(2,4).map(im=>{
    const c=canvas(MW,MH),g=c.getContext('2d');g.drawImage(im,0,0);return g.getImageData(0,0,MW,MH).data;
  });
  // Camera-relative rays -> legacy equirectangular world directions.
  // B is a proper rotation; changing it chooses the diagram's coordinate frame.
  const S=Math.SQRT1_2;
  function bilinear(data,w,h,x,y,out,at) {
    x=Math.max(0,Math.min(w-1.001,x));y=Math.max(0,Math.min(h-1.001,y));
    const ix=Math.floor(x),iy=Math.floor(y),a=x-ix,b=y-iy,j=(iy*w+ix)*4;
    for(let c=0;c<3;c++)out[at+c]=(data[j+c]*(1-a)+data[j+4+c]*a)*(1-b)+(data[j+w*4+c]*(1-a)+data[j+(w+1)*4+c]*a)*b;
    out[at+3]=255;
  }
  const outputs=['left','right'].map(id=>{const c=$(id);c.width=OW;c.height=OH;return {canvas:c,ctx:c.getContext('2d'),image:new ImageData(OW,OH)};});
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let phase=0, target=targets[0].slice(), selected=0;
  let visible=false, raf=0, lastFrame=0, lastTime=0, frameCount=0, bg;
  let missing=[0,0], cssWidth=600;
  const sphereBounds=[];
  function outputRay(b,u,v) { return rotate(b,[(u-OW/2)/VF,(v-OH/2)/VF,1]); }
  function cropBounds(b) { return [[0,0],[OW,0],[OW,OH],[0,OH]].map(([u,v])=>outputRay(b,u,v)); }
  function resample(index,b) {
    const image=outputs[index].image,pixels=image.data,map=maps[index];let absent=0;
    for(let v=0;v<OH;v++)for(let u=0;u<OW;u++) {
      const px=(u+.5-OW/2)/VF,py=(v+.5-OH/2)/VF;
      const rx=b[0][0]*px+b[1][0]*py+b[2][0];
      const ry=b[0][1]*px+b[1][1]*py+b[2][1];
      const rz=b[0][2]*px+b[1][2]*py+b[2][2];
      const wx=S*(rz-ry),wz=-S*(ry+rz),n=Math.hypot(rx,ry,rz);
      const mx=(Math.atan2(rx,wx)/Math.PI+1)*MW/2-.5;
      const my=Math.acos(Math.max(-1,Math.min(1,wz/n)))*MH/Math.PI-.5;
      const ix=Math.floor(mx),iy=Math.floor(my),j=(iy*MW+ix)*4,k=(v*OW+u)*4;
      // Mask the interpolation footprint; never extend image colors into missing directions.
      if(ix<0||ix>=MW-1||iy<0||iy>=MH-1||map[j+3]<250||map[j+7]<250||map[j+MW*4+3]<250||map[j+(MW+1)*4+3]<250) {
        const stripe=((u+v)%14)<3;pixels[k]=stripe?213:243;pixels[k+1]=stripe?202:239;pixels[k+2]=stripe?193:234;pixels[k+3]=255;absent++;
      } else bilinear(map,MW,MH,mx,my,pixels,k);
    }
    outputs[index].ctx.putImageData(image,0,0);return absent/(OW*OH);
  }
  function line(points,color=C.line,width=1,dash=[]) {
    ctx.beginPath();points.forEach((p,i)=>{const q=project(p);i?ctx.lineTo(...q):ctx.moveTo(...q);});
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);
  }
  function polygon(points,fill,stroke=C.line,width=1) {
    ctx.beginPath();points.forEach((p,i)=>{const q=project(p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
  }
  function label(text,p,color=C.muted,size=13,offset=[0,0]) {
    const q=project(p);ctx.font=`${Math.max(size,12*600/cssWidth)}px "Avenir Next", Avenir, sans-serif`;
    ctx.fillStyle=color;ctx.fillText(text,q[0]+offset[0],q[1]+offset[1]);
  }
  function dotAt(p,r,fill,stroke) {
    const q=project(p);ctx.beginPath();ctx.arc(...q,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.2;ctx.stroke();}
  }
  function arrow(a,b,color,width=1.3) {
    line([a,b],color,width);const p=project(a),q=project(b),angle=Math.atan2(q[1]-p[1],q[0]-p[0]);
    ctx.beginPath();ctx.moveTo(q[0]-6*Math.cos(angle-.45),q[1]-6*Math.sin(angle-.45));ctx.lineTo(...q);ctx.lineTo(q[0]-6*Math.cos(angle+.45),q[1]-6*Math.sin(angle+.45));ctx.strokeStyle=color;ctx.stroke();
  }
  function triangle(image,uv,points) {
    const p=points.map(project),[a,b,c]=uv;
    const den=a[0]*(b[1]-c[1])+b[0]*(c[1]-a[1])+c[0]*(a[1]-b[1]);
    if(Math.abs(den)<1e-8)return;
    const coefficients = j => [
      (p[0][j]*(b[1]-c[1])+p[1][j]*(c[1]-a[1])+p[2][j]*(a[1]-b[1]))/den,
      (p[0][j]*(c[0]-b[0])+p[1][j]*(a[0]-c[0])+p[2][j]*(b[0]-a[0]))/den,
      (p[0][j]*(b[0]*c[1]-c[0]*b[1])+p[1][j]*(c[0]*a[1]-a[0]*c[1])+p[2][j]*(a[0]*b[1]-b[0]*a[1]))/den];
    const x=coefficients(0),y=coefficients(1);
    ctx.save();ctx.beginPath();p.forEach((q,i)=>i?ctx.lineTo(...q):ctx.moveTo(...q));ctx.closePath();ctx.clip();
    ctx.transform(x[0],y[0],x[1],y[1],x[2],y[2]);ctx.drawImage(image,0,0);ctx.restore();
  }
  function sourceSphere(camera,index) {
    // Direction sphere belongs to its own optical center. It is not a scene mesh.
    const point=(u,v)=>add(camera,mul(unit([(u-SW/2)/SF,(v-SH/2)/SF,1]),RADIUS));
    const outline=[];
    for(let j=0;j<=24;j++){
      const f=j/24;
      outline.push(project(point(f*SW,0)),project(point(f*SW,SH)),
        project(point(0,f*SH)),project(point(SW,f*SH)));
    }
    sphereBounds[index]={
      left:Math.min(...outline.map(p=>p[0])),
      top:Math.min(...outline.map(p=>p[1])),
      bottom:Math.max(...outline.map(p=>p[1])),
    };
    ctx.globalAlpha=.98;
    for(let y=0;y<16;y++)for(let x=0;x<24;x++) {
      const u=x*SW/24,v=y*SH/16,du=SW/24,dv=SH/16;
      triangle(sources[index].canvas,[[u,v],[u+du,v],[u,v+dv]],[point(u,v),point(u+du,v),point(u,v+dv)]);
      triangle(sources[index].canvas,[[u+du,v],[u+du,v+dv],[u,v+dv]],[point(u+du,v),point(u+du,v+dv),point(u,v+dv)]);
    }
    ctx.globalAlpha=1;
    for(let j=0;j<=4;j++) {
      const horizontal=[],vertical=[];
      for(let i=0;i<=36;i++){horizontal.push(point(i/36*SW,j/4*SH));vertical.push(point(j/4*SW,i/36*SH));}
      line(horizontal,'rgba(153,176,164,.32)',.6);line(vertical,'rgba(153,176,164,.32)',.6);
    }
  }
  function cameraOrigin(c,index) {
    dotAt(c,4,'#fff','#8ea3ae');dotAt(c,1.8,'#7b929e');
    label(index===0?'L':'R',c,C.ink,12,[-4,-12]);
  }
  function tapeSketch(t,index) {
    // Hollow cylinders, rasterized once with the static diagram background.
    // Their dimensions and lighting are illustrative, not reconstructed meshes.
    const along=[0,-Math.SQRT1_2,Math.SQRT1_2];
    const lift=[0,-Math.SQRT1_2,-Math.SQRT1_2];
    const radius=index===0?.63:.84, inner=radius*.63, height=index===0?.58:.78;
    const top=add(t,mul(lift,height*.5)), bottom=add(top,mul(lift,-height));
    const rim=(center,r,a)=>add(center,add([r*Math.cos(a),0,0],mul(along,r*Math.sin(a))));
    const ring=(center,r)=>Array.from({length:65},(_,j)=>rim(center,r,j/64*Math.PI*2));
    const topOuter=ring(top,radius), topInner=ring(top,inner);
    const bottomOuter=ring(bottom,radius), bottomInner=ring(bottom,inner);
    const colors=index===0?
      {edge:'#b79b4e',light:'#f5eac2',face:'#e5d195',wall:[204,178,101],core:'#c6b58c',coreEdge:'#aa9876'}:
      {edge:'#818d91',light:'#e6ebeb',face:'#cbd3d5',wall:[157,171,177],core:'#c6c4b8',coreEdge:'#9c9f96'};
    const path=points=>{ctx.beginPath();points.forEach((p,i)=>{const q=project(p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.closePath();};
    const towardViewer=sub([0,0,-4],t);
    const front=a=>dot(add([Math.cos(a),0,0],mul(along,Math.sin(a))),towardViewer)>0;

    // A small contact shadow and a shaded front wall make the extrusion legible.
    ctx.save();ctx.shadowColor='rgba(62,72,65,.13)';ctx.shadowBlur=5;
    polygon(ring(add(bottom,mul(lift,-.025)),radius*1.035),'rgba(62,72,65,.08)',null);ctx.restore();
    for(let j=0;j<64;j++){
      const a=(j+.5)/64*Math.PI*2;
      if(!front(a))continue;
      const light=.91+.11*Math.cos(a-3.8);
      const color=`rgb(${colors.wall.map(v=>Math.round(v*light)).join(',')})`;
      polygon([topOuter[j],topOuter[j+1],bottomOuter[j+1],bottomOuter[j]],color,color,.4);
    }
    // The underside of the front wall is a single clean contour.
    for(let j=0;j<64;j++)if(front((j+.5)/64*Math.PI*2))line([bottomOuter[j],bottomOuter[j+1]],colors.edge,.8);

    const [cx,cy]=project(top), extent=490*radius/(4+top[2]);
    const face=ctx.createLinearGradient(cx-extent,cy-extent,cx+extent,cy+extent);
    face.addColorStop(0,colors.light);face.addColorStop(1,colors.face);
    path(topOuter);ctx.fillStyle=face;ctx.fill();

    // Clip the cardboard inner wall to the open top, leaving the table visible
    // through the lower aperture rather than filling the hole with a dark disk.
    ctx.save();path(topInner);ctx.clip();ctx.fillStyle='#f4f5f1';ctx.fill();
    for(let j=0;j<64;j++){
      if(front((j+.5)/64*Math.PI*2))continue;
      polygon([topInner[j],topInner[j+1],bottomInner[j+1],bottomInner[j]],colors.core,colors.core,.4);
      line([bottomInner[j],bottomInner[j+1]],colors.coreEdge,.75);
    }
    ctx.restore();
    line(topOuter,colors.edge,1.05);line(topInner,colors.coreEdge,1);
    line(ring(top,radius*.94),index===0?'#d5be78':'#b6c1c4',.55);
  }
  function paintStatic() {
    ctx.clearRect(0,0,600,420);ctx.fillStyle='#fff';ctx.fillRect(0,0,600,420);
    // Reference table under the cameras. In the display's 45deg camera frame,
    // a horizontal table has y+z=constant. Height is illustrative, not measured.
    const table=(x,z)=>[x,15.8-z,z];
    polygon([table(-5,8.7),table(5,8.7),table(5,12),table(-5,12)],'#f6f7f5','#dfe4df',1);
    const edge=[table(-5,8.7),table(5,8.7)];
    polygon([edge[0],edge[1],add(edge[1],[0,.12,.12]),add(edge[0],[0,.12,.12])],'#eef0ed','#dfe4df',.6);
    targets.forEach((t,i)=>tapeSketch(tablePosition(t),i));
    sourceSphere(cameras[0],0);sourceSphere(cameras[1],1);
    line(cameras,'#c9d3d8',1,[3,4]);
    cameras.forEach(cameraOrigin);
    bg=canvas(scene.width,scene.height);bg.getContext('2d').drawImage(scene,0,0);
  }
  function draw() {
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(bg,0,0);ctx.restore();
    const frames=cameras.map(c=>basis(sub(target,c)));
    cameras.forEach((c,i)=>{
      const b=frames[i],bounds=cropBounds(b),patch=bounds.map(r=>add(c,mul(unit(r),RADIUS)));
      const perimeter=[];
      for(let edge=0;edge<4;edge++)for(let step=0;step<12;step++) {
        const ray=add(mul(bounds[edge],1-step/12),mul(bounds[(edge+1)%4],step/12));
        perimeter.push(add(c,mul(unit(ray),RADIUS)));
      }
      polygon(perimeter,'rgba(182,218,202,.10)','#72aa8b',1.9);
      // Ray fans end on the directional patch, not on invented scene geometry.
      patch.forEach(p=>line([c,p],'#b3cebf',.85));
      const sampledPoint=add(c,mul(b[2],RADIUS));
      line([sampledPoint,tablePosition(target)],C.mint,1.6);
      dotAt(sampledPoint,3,'#709b84');
      missing[i]=resample(i,b);
    });
    // The camera origins stay fixed; no coordinate triads or interior planes.
    cameras.forEach(cameraOrigin);
    const tableTarget=tablePosition(target);
    dotAt(tableTarget,10,'rgba(245,198,170,.32)');dotAt(tableTarget,5,C.peach,'#cf9c7d');
    frameCount++;
    const coverage=missing.some(n=>n>.001);
    const name=selected<0?'Scanning':names[selected];
    const text=coverage?`${name} · missing source: L ${(missing[0]*100).toFixed(1)}% / R ${(missing[1]*100).toFixed(1)}% (hatched).`:`${name} · the cameras stay fixed.`;
    if(status.textContent!==text)status.textContent=text;
    status.dataset.missing=String(coverage);
    // Scoped diagnostics make geometry / scheduling regressions reviewable.
    root.dataset.frames=String(frameCount);
    root.dataset.source="recorded-stereo-still";
    root.dataset.sourceResolution=`${MW}x${MH}`;
    root.dataset.outputFov=String(FOV);
    root.dataset.projectedCameras=JSON.stringify(cameras.map(project));
    root.dataset.projectedTargets=JSON.stringify(targets.map(t=>project(tablePosition(t))));
    root.dataset.target=target.join(',');
    root.dataset.cameraCenters=JSON.stringify(cameras);
    root.dataset.cameraRotations='identity,identity';
    root.dataset.gazeDirections=JSON.stringify(frames.map(b=>b[2]));
    root.dataset.handedness=frames.map(b=>dot(cross(b[0],b[1]),b[2]).toFixed(8)).join(',');
    root.dataset.missing=missing.join(',');
    root.dataset.running=String(eligible());
  }
  function sampleScan(p) {
    // 12-second loop: hold yellow; move; hold grey; return. Continuous endpoints.
    const t=p*12;let blend;
    if(t<2.4)blend=0;else if(t<5.4)blend=(t-2.4)/3;else if(t<8.4)blend=1;else blend=1-(t-8.4)/3.6;
    blend=blend*blend*(3-2*blend);
    target=targets[0].map((x,i)=>x+(targets[1][i]-x)*blend);
    selected=blend<.001?0:blend>.999?1:-1;
  }
  function eligible() {return visible&&!document.hidden&&!motion.matches;}
  function tick(now) {
    raf=0;if(!eligible()){root.dataset.running='false';lastTime=0;return;}
    if(now-lastFrame>=1000/24) {
      const dt=lastTime?Math.min(now-lastTime,120):0;lastTime=now;lastFrame=now;
      phase=(phase+dt/12000)%1;sampleScan(phase);draw();
    }
    raf=requestAnimationFrame(tick);
  }
  function schedule() {
    if(raf)cancelAnimationFrame(raf);raf=0;lastTime=0;
    root.dataset.running=String(eligible());
    if(eligible())raf=requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange',schedule);
  motion.addEventListener('change',()=>{schedule();draw();});
  window.addEventListener('pagehide',()=>{if(raf)cancelAnimationFrame(raf);raf=0;});
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();},{threshold:0});
  observer.observe(root.querySelector('.gym-spatial-layout'));
  function positionProjectionArrow() {
    const arrow=root.querySelector('.gym-spatial-projection-arrow');
    const sources=root.querySelector('.gym-spatial-sources');
    if(matchMedia('(max-width:660px)').matches){
      ['left','top','width'].forEach(p=>arrow.style.removeProperty(p));return;
    }
    const layout=root.querySelector('.gym-spatial-layout').getBoundingClientRect();
    const inputs=sources.getBoundingClientRect();
    const rect=scene.getBoundingClientRect(),scale=rect.width/600;
    const sphereLeft=rect.left+Math.min(...sphereBounds.map(b=>b.left))*scale;
    const sphereMiddle=rect.top+(Math.min(...sphereBounds.map(b=>b.top))+
      Math.max(...sphereBounds.map(b=>b.bottom)))*scale/2;
    const gap=sphereLeft-inputs.right,padding=Math.min(20,gap*.2);
    arrow.style.left=`${inputs.right+padding-layout.left}px`;
    arrow.style.width=`${Math.max(12,gap-2*padding)}px`;
    arrow.style.top=`${((inputs.top+inputs.bottom)/2+sphereMiddle)/2-layout.top}px`;
  }
  function resize() {
    cssWidth=scene.getBoundingClientRect().width;
    const scale=Math.min(devicePixelRatio||1,2)*cssWidth/600;
    scene.width=Math.max(1,Math.round(600*scale));scene.height=Math.max(1,Math.round(420*scale));
    ctx.setTransform(scene.width/600,0,0,scene.height/420,0,0);paintStatic();draw();
    positionProjectionArrow();
  }
  new ResizeObserver(resize).observe(scene);
  resize();
})();
