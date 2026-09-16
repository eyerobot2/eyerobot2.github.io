const {chromium}=require('playwright');const fs=require('fs');
const config=JSON.parse(fs.readFileSync('data/results-charts.json'));
const {server}=require(process.cwd()+'/scripts/serve_media.cjs');
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;const browser=await chromium.launch({channel:'chrome',headless:true});const issues=[], report=[];
for(const width of [1440,960,760,390,320]){
 const page=await browser.newPage({viewport:{width,height:1000}});const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));page.on('response',r=>{if(r.status()>=400&&/127\.0\.0\.1/.test(r.url()))errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelectorAll('[data-chart-ready=true]').length===6);await page.waitForSelector('[data-camera-ready=true]');
 if(requests.some(u=>u.includes('/figure-lab/')))issues.push(`${width}: experiment dependency`);
 if(requests.some(u=>u.includes('/camera-comparisons/')&&u.includes('.mp4')))issues.push(`${width}: initial camera MP4 requests`);
 for(const [key,cfg] of Object.entries(config)){
  const host=page.locator(`[data-results-chart="${key}"]`);await host.scrollIntoViewIfNeeded();
  for(const metric of cfg.metrics){
   if(cfg.metrics.length>1)await host.locator(`[data-metric="${metric.key}"]`).click();
   const state=await host.evaluate(el=>{
    const svg=el.querySelector('svg');const rect=svg.getBoundingClientRect();const issues=[];
    const texts=[...svg.querySelectorAll('text')];
    for(const t of texts){const b=t.getBoundingClientRect();if(b.left<rect.left-1||b.right>rect.right+1)issues.push('clipped '+t.textContent);}
    for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){
     const a=texts[i].getBoundingClientRect(),b=texts[j].getBoundingClientRect();if(a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1)issues.push('overlap '+texts[i].textContent+'/'+texts[j].textContent);
    }
    const bars=[...svg.querySelectorAll('.rp-bar')].map(b=>({task:b.closest('[data-task]').dataset.task,method:b.dataset.method,value:Number(b.dataset.value)}));
    return {issues,bars,metric:el.dataset.metric,caption:el.querySelector('figcaption').textContent,transition:getComputedStyle(svg.querySelector('.rp-bar')).transitionDuration,width:rect.width,height:rect.height,pressed:el.querySelectorAll('button[aria-pressed=true]').length};
   });
   issues.push(...state.issues.map(x=>`${width} ${key} ${metric.key}: ${x}`));
   if(state.metric!==metric.key||state.caption!==metric.caption||state.transition!=='0s'||(cfg.metrics.length>1&&state.pressed!==1))issues.push(`${width} ${key}: metric state`);
   for(const bar of state.bars){const expected=cfg.rows.find(r=>r.key===bar.task).values[metric.key][bar.method];if(Math.abs(expected-bar.value)>1e-8)issues.push(`${width} ${key}: wrong value`);}
   if(state.bars.length!==cfg.rows.length*cfg.methods.length)issues.push(`${width} ${key}: missing bars`);
   report.push({width,key,metric:metric.key,plotHeight:state.height});
  }
  if(width===1440||width===390)await host.screenshot({path:`/tmp/main-result-${key}-${width}.png`});
 }
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)issues.push(`${width}: page overflow`);
 for(const group of ['clear','occluded']){
  const sample=page.locator(`[data-camera-group="${group}"]`);const buttons=sample.locator('[data-camera-index]');
  for(let index=0;index<await buttons.count();index++){
   await buttons.nth(index).click();const visible=sample.locator('.camera-trial:not([hidden])');await visible.scrollIntoViewIfNeeded();
   await page.waitForFunction(group=>[...document.querySelectorAll(`[data-camera-group="${group}"] .camera-trial:not([hidden]) video`)].every(v=>v.readyState>=1),group);
   const state=await sample.evaluate(el=>({visible:el.querySelectorAll('.camera-trial:not([hidden])').length,pressed:el.querySelectorAll('button[aria-pressed=true]').length,hiddenPlaying:[...el.querySelectorAll('.camera-trial[hidden] video')].some(v=>!v.paused),dimensions:[...el.querySelectorAll('.camera-trial:not([hidden]) video')].map(v=>[v.videoWidth,v.videoHeight]),feedback:el.querySelectorAll('.media-feedback').length}));
   if(state.visible!==1||state.pressed!==1||state.hiddenPlaying||state.feedback!==1||JSON.stringify(state.dimensions)!=='[[1280,480],[640,320]]')issues.push(`${width} ${group} ${index}: ${JSON.stringify(state)}`);
  }
 }
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(400);if(await page.locator('.camera-comparisons video').evaluateAll(vs=>vs.some(v=>!v.paused)))issues.push(`${width}: offscreen playback`);
 const ids=await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return ids.filter((id,i)=>ids.indexOf(id)!==i);});if(ids.length)issues.push(`${width}: duplicate IDs ${ids}`);
 issues.push(...errors.map(e=>`${width}: ${e}`));await page.close();
}
const page=await browser.newPage();await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});await page.locator('[data-camera-group=clear]').scrollIntoViewIfNeeded();await page.waitForTimeout(500);if(await page.locator('.camera-comparisons video').evaluateAll(vs=>vs.some(v=>!v.paused)))issues.push('reduced-motion camera autoplay');
await browser.close();server.close();fs.writeFileSync('/tmp/main-results-report.json',JSON.stringify({issues,report},null,2));console.log(JSON.stringify({issues,chartChecks:report.length},null,2));process.exitCode=issues.length?1:0;
})().catch(e=>{console.error(e);process.exit(1);});
