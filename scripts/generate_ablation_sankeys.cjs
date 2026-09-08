// Regenerate the site's Sankeys from the results browser's renderer and data.
// Run from the repository root: node scripts/generate_ablation_sankeys.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('viewer/app.js', 'utf8');
const functions = ['displayLabel', 'escapeHtml'].map(name => {
  const start = source.indexOf(`function ${name}(`);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}).join('\n');
// Keep the browser's flow calculation, but compress the bands for the paper page.
// Text stays at its original size; every trial still uses the same width scale.
const renderer = source.slice(source.indexOf('function pctStr('), source.indexOf('// ---------- Episodes ----------'))
  .replace('PAD_T = 44, NODE_W = 9, GAP = 13', 'PAD_T = 36, NODE_W = 9, GAP = 8')
  .replace('const FUNNEL_H = 188;', 'const FUNNEL_H = 64;')
  .replace('const VB_H = bottomMax + 20;', 'const VB_H = bottomMax + 16;');
const context = vm.createContext({});
vm.runInContext(functions + '\n' + renderer, context);
const tasks = ['marker', 'tea', 'toaster', 'wrench', 'boba', 'tape', 'pot place'];
const policies = [['eyeball', 'AVF'], ['peripheral', 'Without foveation'], ['mono', 'Without stereo']];
const css = `.funnel-flow{stroke:none}.funnel-flow.spine{fill:#059669;opacity:.16}.funnel-flow.success{fill:#059669;opacity:.55}.funnel-flow.win{fill:#059669;opacity:.42}.funnel-flow.fail{fill:#b91c1c;opacity:.38}.funnel-bar.start{fill:#aaa}.funnel-bar.spine,.funnel-bar.success,.funnel-bar.win{fill:#059669}.funnel-bar.fail{fill:#b91c1c}.funnel-name{font-family:Arial,sans-serif;font-size:12.5px;font-weight:600;fill:#333}.funnel-sub{font-family:Arial,sans-serif;font-size:11px;fill:#777}.funnel-name.success,.funnel-name.win,.funnel-sub.success,.funnel-sub.win{fill:#059669}.funnel-name.fail,.funnel-sub.fail{fill:#b91c1c}`;
fs.mkdirSync('images/ablation-sankeys', { recursive: true });
let html = '<!-- BEGIN GENERATED ABLATION SANKEYS -->\n<div class="ablation-sankeys">\n<div class="ablation-task-picker" role="group" aria-label="Choose an ablation task">\n';
for (const [i, task] of tasks.entries()) {
  const slug = task.replaceAll(' ', '-');
  const label = task === 'pot place' ? 'Pot lid' : context.displayLabel(task);
  html += `<button type="button" data-ablation-task="${slug}" aria-controls="ablation-${slug}" aria-pressed="${i === 0}">${label}</button>\n`;
}
html += '</div>\n';
for (const [i, task] of tasks.entries()) {
  const slug = task.replaceAll(' ', '-');
  const label = task === 'pot place' ? 'Pot lid' : context.displayLabel(task);
  html += `<div class="ablation-task-panel" id="ablation-${slug}"${i ? ' hidden' : ''}>\n`;
  for (const [policy, name] of policies) {
    const data = JSON.parse(fs.readFileSync(`viewer/data/episodes/${policy}__${slug}.json`, 'utf8'));
    const funnel = data.funnel;
    if (!funnel?.total) throw new Error(`Missing funnel for ${policy}/${task}`);
    let svg = context.renderFunnel(funnel).match(/<svg[\s\S]*?<\/svg>/)[0];
    // The browser uses overflow:visible for the first label; reserve that room in the asset.
    svg = svg.replace(/viewBox="0 0 ([\d.]+) ([\d.]+)"/, (_, w, h) => `viewBox="-28 0 ${Number(w) + 34} ${h}"`);
    svg = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    svg = svg.replace(/aria-label="Success funnel"/, `aria-label="${name}: ${label}"`);
    svg = svg.replace(/(<svg[^>]+>)/, `$1<style>${css}</style>`);
    const path = `images/ablation-sankeys/${policy}__${slug}.svg`;
    fs.writeFileSync(path, svg + '\n');
    const rate = Math.round(100 * funnel.success_count / funnel.total);
    html += `<figure class="ablation-sankey"><figcaption><span>${name}</span><span>${funnel.success_count}/${funnel.total} succeeded · ${rate}%</span></figcaption><a href="viewer/#/episodes/${policy}/${encodeURIComponent(task)}" aria-label="Browse ${name} ${label} trials"><img src="${path}" alt="${name}, ${label}: stage-by-stage trial progression; ${funnel.success_count} of ${funnel.total} trials succeeded" loading="lazy" /></a></figure>\n`;
  }
  html += '</div>\n';
}
html += '<p class="carousel-caption">Trial progression for AVF and its vision ablations. Flow widths represent trial counts; red branches show where trials drop out. Stage percentages are conditional on reaching the preceding stage. Select a diagram to browse its trials.</p>\n</div>\n<!-- END GENERATED ABLATION SANKEYS -->';
const page = fs.readFileSync('index.html', 'utf8');
if (!page.includes('<!-- BEGIN GENERATED ABLATION SANKEYS -->')) throw new Error('Missing insertion markers');
fs.writeFileSync('index.html', page.replace(/<!-- BEGIN GENERATED ABLATION SANKEYS -->[\s\S]*?<!-- END GENERATED ABLATION SANKEYS -->/, html));
console.log('Generated 21 Sankeys across seven tasks from results browser data.');
