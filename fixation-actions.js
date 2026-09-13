(() => {
    'use strict';
    document.querySelectorAll('[data-fixation-actions]').forEach(init);

    function init(root) {
        const canvases = [...root.querySelectorAll('canvas')];
        const colors = ['#c46b65', '#5f987e', '#658bb8'];
        const defaultView = {yaw: 1.05, pitch: .32, zoom: 1.12};
        let {yaw, pitch, zoom} = defaultView;
        let drag = null, views = [];
        let inViewport = false, swayTimer = null, lastSway = null, swayTime = 0;
        const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
        let radius = .3, tableBounds = null;
        let activeExample = null;
        const exampleButtons = [...root.querySelectorAll('.rgb-frame')];
        // Precompute glyph segments once per selection. Each redraw needs only six
        // batched strokes per panel, with no pose interpolation or depth sorting.
        const buildGeometry = (poses, endpoints) => [false, true].map(head => ({
            head,
            axes: [0, 1, 2].map(axis => {
                const segments = [];
                poses.forEach((p, i) => {
                    if (endpoints.has(i) !== head) return;
                    segments.push(...p.slice(0,3), p[0]+.015*p[3+axis], p[1]+.015*p[6+axis], p[2]+.015*p[9+axis]);
                });
                return new Float64Array(segments);
            })
        }));
        const draw = () => {
            if (!views.length) return;
            const scale = Math.min(...canvases.flatMap(c => [c.clientWidth, c.clientHeight])) * .43 * zoom / radius;
            views.forEach(view => drawView(view, scale));
        };
        const drawView = (view, scale) => {
            const {canvas, center} = view, ctx = canvas.getContext('2d');
            const width = canvas.clientWidth, height = canvas.clientHeight, dpr = devicePixelRatio || 1;
            if (canvas.width !== Math.round(width*dpr) || canvas.height !== Math.round(height*dpr)) {
                canvas.width = Math.round(width*dpr); canvas.height = Math.round(height*dpr);
            }
            ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,width,height);
            const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
            const project = p => {
                const [x,y,z] = p.map((v,i) => v-center[i]);
                const depth = sy*x+cy*y;
                return [width/2 + (cy*x-sy*y)*scale, height/2 - (cp*z+sp*depth)*scale, -cp*depth+sp*z];
            };
            const line = (a,b) => { ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); };
            ctx.globalAlpha = 1;
            if (view.name === 'World') {
                // eye/table_frame.py TABLE_HEIGHT; displayed table edges are illustrative.
                const [x0,x1,y0,y1] = tableBounds, z = -.03175;
                const corners = [[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]].map(project);
                ctx.beginPath(); ctx.moveTo(corners[0][0],corners[0][1]);
                corners.slice(1).forEach(p => ctx.lineTo(p[0],p[1])); ctx.closePath();
                ctx.fillStyle = '#f7f7f6'; ctx.fill();
                ctx.strokeStyle = '#e6e6e3'; ctx.lineWidth = .7; ctx.stroke();
                ctx.strokeStyle = '#ededea'; ctx.beginPath();
                for (let x=Math.ceil(x0*10)/10;x<x1;x+=.1) line(project([x,y0,z]),project([x,y1,z]));
                for (let y=Math.ceil(y0*10)/10;y<y1;y+=.1) line(project([x0,y,z]),project([x1,y,z]));
                ctx.stroke();
            }
            ctx.lineCap = 'round';
            for (const {head, axes} of view.geometry) {
                ctx.globalAlpha = head ? 1 : .2;
                ctx.lineWidth = head ? 1.9 : .5;
                for (let axis = 0; axis < 3; axis++) {
                    ctx.strokeStyle = colors[axis]; ctx.beginPath();
                    const segments = axes[axis];
                    for (let i = 0; i < segments.length; i += 6) {
                        // Scalar projection avoids allocating point arrays per frame.
                        for (let end = 0; end < 2; end++) {
                            const k = i + end*3;
                            const x=segments[k]-center[0], y=segments[k+1]-center[1], z=segments[k+2]-center[2];
                            const px=width/2+(cy*x-sy*y)*scale;
                            const py=height/2-(cp*z+sp*(sy*x+cy*y))*scale;
                            if (end) ctx.lineTo(px,py); else ctx.moveTo(px,py);
                        }
                    }
                    ctx.stroke();
                }
            }
            ctx.globalAlpha = 1;
            if (view.name === 'Fixation') {
                const origin = project(view.camera.position);
                // Small true camera axes, kept quieter than the gripper glyphs.
                ctx.globalAlpha = .55; ctx.lineWidth = 1;
                for (let axis = 0; axis < 3; axis++) {
                    const length = axis === 2 ? .08 : .035;
                    const tip = project(view.camera.position.map((v,i) => v+length*view.camera.rotation[i*3+axis]));
                    ctx.strokeStyle = colors[axis]; ctx.beginPath(); line(origin,tip); ctx.stroke();
                    if (axis === 2) {
                        const angle = Math.atan2(tip[1]-origin[1],tip[0]-origin[0]);
                        ctx.beginPath(); line(tip,[tip[0]-4*Math.cos(angle-.5),tip[1]-4*Math.sin(angle-.5)]);
                        line(tip,[tip[0]-4*Math.cos(angle+.5),tip[1]-4*Math.sin(angle+.5)]); ctx.stroke();
                    }
                }
                ctx.globalAlpha = 1; ctx.fillStyle = '#999'; ctx.font = '10px Avenir, sans-serif';
                ctx.fillText('Camera',origin[0]+6,origin[1]+13);
            }
            if (activeExample !== null && view.examples) {
                const p = view.examples[activeExample], origin = project(p.slice(0,3));
                ctx.lineWidth = 2; ctx.globalAlpha = 1;
                for (let axis = 0; axis < 3; axis++) {
                    const end = project([p[0]+.025*p[3+axis],p[1]+.025*p[6+axis],p[2]+.025*p[9+axis]]);
                    ctx.strokeStyle=colors[axis];ctx.beginPath();line(origin,end);ctx.stroke();
                }
                ctx.beginPath();ctx.arc(origin[0],origin[1],8,0,Math.PI*2);
                ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();ctx.strokeStyle='#555';ctx.lineWidth=1;ctx.stroke();
            }
            ctx.lineWidth = 1; ctx.strokeStyle = '#bbb';
            ctx.beginPath(); line([18,height-18],[18+.1*scale,height-18]); ctx.stroke();
            ctx.fillStyle = '#aaa'; ctx.font = '10px Avenir, sans-serif'; ctx.fillText('10 cm',18,height-26);
        };
        const reset = () => { ({yaw,pitch,zoom}=defaultView); swayTime=0; lastSway=null; draw(); };
        for (const canvas of canvases) {
            canvas.addEventListener('pointerdown', e => {
                drag={canvas,x:e.clientX,y:e.clientY};
                scheduleSway();
                canvas.setPointerCapture(e.pointerId);
            });
            canvas.addEventListener('pointermove', e => {
                if (!drag || drag.canvas!==canvas) return;
                yaw+=(e.clientX-drag.x)*.008; pitch=Math.max(-1.5,Math.min(1.5,pitch+(e.clientY-drag.y)*.008));
                drag.x=e.clientX; drag.y=e.clientY; draw();
            });
            for (const type of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(type,()=>{
                drag=null; scheduleSway();
            });
            canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.5,Math.min(4,zoom*Math.exp(-e.deltaY*.001)));draw();},{passive:false});
            canvas.addEventListener('keydown',e=>{
                if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0'].includes(e.key)) return;
                e.preventDefault();
                if(e.key==='ArrowLeft')yaw-=.08;if(e.key==='ArrowRight')yaw+=.08;
                if(e.key==='ArrowUp')pitch+=.08;if(e.key==='ArrowDown')pitch-=.08;
                if(e.key==='+'||e.key==='=')zoom*=1.1;if(e.key==='-')zoom/=1.1;
                pitch=Math.max(-1.5,Math.min(1.5,pitch));zoom=Math.max(.5,Math.min(4,zoom));
                if(e.key==='0')reset();else draw();
            });
            new ResizeObserver(draw).observe(canvas);
        }
        const scheduleSway = () => {
            const active = !drag && !reducedMotion.matches && inViewport && !document.hidden && views.length;
            if (!active) { clearTimeout(swayTimer); swayTimer=null; lastSway=null; return; }
            if (swayTimer !== null) return;
            swayTimer = setTimeout(() => {
                swayTimer = null;
                const now = performance.now();
                const previousPhase = swayTime/8000*Math.PI*2;
                if (lastSway !== null) swayTime += now-lastSway;
                lastSway = now;
                const phase = swayTime/8000*Math.PI*2;
                // Add only the change in sway, preserving the user's camera angle.
                yaw += .077*(Math.sin(phase)-Math.sin(previousPhase));
                pitch += .0275*(Math.sin(phase*2)-Math.sin(previousPhase*2));
                draw(); scheduleSway();
            }, 50); // 20 fps is sufficient for this small, slow camera movement.
        };
        const highlightExample = index => {
            activeExample=index;
            exampleButtons.forEach((button,i)=>button.classList.toggle('is-active',i===index));
            draw();
        };
        exampleButtons.forEach((button,index)=>{
            button.addEventListener('pointerenter',()=>highlightExample(index));
            button.addEventListener('focus',()=>highlightExample(index));
            button.addEventListener('click',()=>highlightExample(index));
            button.addEventListener('pointerleave',()=>{if(document.activeElement!==button)highlightExample(null);});
            button.addEventListener('blur',()=>{if(!button.matches(':hover'))highlightExample(null);});
        });
        document.addEventListener('visibilitychange',scheduleSway);
        reducedMotion.addEventListener('change',scheduleSway);
        new IntersectionObserver(([entry]) => {
            inViewport = entry.isIntersecting;
            scheduleSway();
        }).observe(root);
        let loadStarted = false;
        const load = async () => {
            if (loadStarted) return;
            loadStarted = true;
            root.dataset.state = 'loading';
            try {
                const response = await fetch(root.dataset.src);
                if (!response.ok) throw new Error('Could not load recordings. Please refresh to retry.');
                const data = await response.json();
                const endpoints = new Set(data.endpoints);
                radius = data.radius;
                tableBounds = [.12,.56,.08,.39];
                views = [
                    {name:'World',canvas:canvases[0],poses:data.world,center:data.centers[0],examples:data.examples.world},
                    {name:'Fixation',canvas:canvases[1],poses:data.fixation,center:data.centers[1],examples:data.examples.fixation,camera:data.camera}
                ];
                views.forEach(view => { view.geometry=buildGeometry(view.poses,endpoints); });
                root.dataset.state = 'ready';
                draw(); scheduleSway();
            } catch (error) {
                root.dataset.state = 'error';
                const status = root.querySelector('[data-load-status]');
                status.textContent = error.message; status.hidden = false;
            }
        };
        // Keep the pose payload off the initial-page critical path.
        const loadObserver = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) { loadObserver.disconnect(); load(); }
        }, {rootMargin:'400px 0px'});
        loadObserver.observe(root);
    }
})();
