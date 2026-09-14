/* Plots are generated from paper Table 5 by generate_distractor_charts.py. */
(() => {
    const captions = {
        progression: 'Mean percentage of task stages completed.',
        grasp: 'Percentage of trials completing the first grasp.',
        success: 'Percentage of trials completing the full task.',
    };
    const metrics = {progression: 'task progression', grasp: 'first-grasp success', success: 'full-task success'};
    const protocol = ' 25 trials per task bar.';
    document.querySelectorAll('[data-distractor-results]').forEach(root => {
        const buttons = [...root.querySelectorAll('[data-metric]')];
        const image = root.querySelector('img');
        const mobile = root.querySelector('picture source');
        const caption = root.querySelector('figcaption');
        buttons.forEach(button => button.addEventListener('click', () => {
            const metric = button.dataset.metric;
            mobile.srcset = `images/figure_distractor_${metric}-mobile.svg`;
            image.src = `images/figure_distractor_${metric}.svg`;
            image.alt = `Average and per-task ${metrics[metric]} with distractors for No Gaze, Ego plus Wrist, and AVF. Twenty-five trials per task and policy.`;
            caption.textContent = captions[metric] + protocol;
            buttons.forEach(other => {
                const selected = other === button;
                other.classList.toggle('active', selected);
                other.setAttribute('aria-pressed', String(selected));
            });
        }));
        root.querySelector('.plot-metric-toggle').hidden = false;
    });
})();
