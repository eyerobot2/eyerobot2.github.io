/* One static, responsive renderer for the site's quantitative bar charts. */
(() => {
    'use strict';
    const hosts = [...document.querySelectorAll('[data-results-chart]')];
    if (!hosts.length) return;
    const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const format = (value, row) => row.decimals ? Number(value).toFixed(row.decimals) : String(Math.round(value));
    const measure = document.createElement('canvas').getContext('2d');
    function lines(label, width, fontSize) {
        measure.font = `${fontSize}px "Avenir Next", Avenir, sans-serif`;
        const result = []; let line = '';
        for (const word of label.split(' ')) {
            const next = line ? `${line} ${word}` : word;
            if (line && measure.measureText(next).width > width) { result.push(line); line = word; }
            else line = next;
        }
        result.push(line); return result;
    }
    class ResultChart {
        constructor(host, config) {
            this.host = host; this.config = config; this.metric = config.defaultMetric;
            this.id = `result-chart-${host.dataset.resultsChart}`;
            this.width = host.getBoundingClientRect().width || 760;
            const controls = config.metrics.length > 1 ? `<div class="results-controls results-metrics" role="group" aria-label="${escape(config.metrics[0].title)} metric">${config.metrics.map(m => `<button type="button" data-metric="${m.key}" aria-pressed="${m.key === this.metric}" aria-controls="${this.id}">${escape(m.label)}</button>`).join('')}</div>` : '';
            host.innerHTML = `${controls}<div class="results-plot-title"></div><svg id="${this.id}" role="img" aria-labelledby="${this.id}-title ${this.id}-desc"></svg><div class="results-legend">${config.methods.map(m => `<span><i class="results-swatch${m.hatch ? ' results-swatch--hatched' : ''}" style="--series-color:${m.color}" aria-hidden="true"></i>${escape(m.label)}</span>`).join('')}</div><figcaption class="carousel-caption" aria-live="polite"></figcaption>`;
            this.svg = host.querySelector('svg');
            host.querySelectorAll('[data-metric]').forEach(button => button.addEventListener('click', () => {
                this.metric = button.dataset.metric; this.render();
            }));
            this.render();
            this.observer = new ResizeObserver(entries => {
                const width = entries[0].contentRect.width;
                if (width < 180 || Math.abs(this.width - width) < .5) return;
                this.width = width; this.render();
            });
            this.observer.observe(host);
            host.dataset.chartReady = 'true';
        }
        render() {
            const {config, metric} = this;
            const selected = config.metrics.find(m => m.key === metric);
            this.host.dataset.metric = metric;
            this.host.querySelector('.results-plot-title').textContent = selected.title;
            this.host.querySelector('figcaption').textContent = selected.caption;
            this.host.querySelectorAll('[data-metric]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.metric === metric)));
            const width = Math.min(800, this.width);
            const minGroup = config.rows.some(row => row.decimals) ? 76 : config.methods.length === 3 ? 72 : 42;
            const capacity = Math.max(1, Math.floor((width - 64) / minGroup));
            const bandCount = Math.ceil(config.rows.length / capacity);
            const fontSize = width < 380 ? 12 : 13;
            const bandHeight = bandCount > 1 ? 220 : config.compact ? 240 : 275;
            const top = bandCount > 1 ? 24 : 32;
            const base = bandHeight - (bandCount > 1 ? 50 : 35);
            const height = bandCount * bandHeight;
            this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
            const description = config.rows.map(row => `${row.description || row.label}: ${config.methods.map(m => `${m.label} ${format(row.values[metric][m.key], row)}%`).join(', ')}`).join('. ');
            const markup = [`<title id="${this.id}-title">${escape(selected.title)}</title><desc id="${this.id}-desc">${escape(description)}</desc><defs><pattern id="${this.id}-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#f2986f"/><path d="M0 0V7" stroke="#fff" stroke-width="1"/></pattern></defs>`];
            let offset = 0;
            for (let band = 0; band < bandCount; band++) {
                const count = Math.floor(config.rows.length / bandCount) + (band < config.rows.length % bandCount ? 1 : 0);
                const rows = config.rows.slice(offset, offset + count); offset += count;
                const space = (width - 64) / count;
                const barWidth = Math.min(count === 1 ? 70 : 36, space * .73 / config.methods.length);
                markup.push(`<g transform="translate(0 ${band * bandHeight})">`);
                for (const value of [0,25,50,75,100]) {
                    const y = base - (base - top) * value / 100;
                    markup.push(`<line class="rp-grid" x1="42" x2="${width-12}" y1="${y}" y2="${y}"/><text class="rp-tick" x="34" y="${y+4}" text-anchor="end">${value}${value===100?'%':''}</text>`);
                }
                rows.forEach((row, index) => {
                    const center = 48 + space * (index + .5);
                    markup.push(`<g class="rp-task" data-task="${row.key}">`);
                    config.methods.forEach((method, mi) => {
                        const value = row.values[metric][method.key];
                        const barHeight = (base - top) * value / 100;
                        const x = center + (mi - (config.methods.length - 1) / 2) * (barWidth + 2);
                        const fill = method.hatch ? `url(#${this.id}-hatch)` : method.color;
                        markup.push(`<rect class="rp-bar" data-method="${method.key}" data-value="${value}" x="${x-barWidth/2}" y="${base-barHeight}" width="${barWidth}" height="${barHeight}" rx="1" fill="${fill}"/><text class="rp-value" x="${x}" y="${base-barHeight-8}" text-anchor="middle">${format(value,row)}</text>`);
                    });
                    const wrapped = lines(row.label, space - 4, fontSize);
                    markup.push(`<text class="rp-task-label" style="font-size:${fontSize}px" x="${center}" y="${base+25}" text-anchor="middle">${wrapped.map((line,i)=>`<tspan x="${center}" dy="${i?15:0}">${escape(line)}</tspan>`).join('')}</text></g>`);
                });
                markup.push('</g>');
            }
            this.svg.innerHTML = markup.join('');
        }
    }
    fetch('data/results-charts.json').then(response => {
        if (!response.ok) throw new Error('Could not load result values.');
        return response.json();
    }).then(charts => {
        hosts.forEach(host => { const config = charts[host.dataset.resultsChart]; if (config) new ResultChart(host, config); });
    }).catch(error => console.warn('Keeping static chart fallbacks:', error));
})();
