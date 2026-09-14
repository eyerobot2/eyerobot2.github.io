"""Plot raw distractor results from paper Table 5 (p. 18).

CSV fractions retain the original 25-trial denominator. Task progression
averages stage success fractions, excluding the duplicate completion column.
The overall average gives each of the three tasks equal weight.
"""
import csv
from fractions import Fraction
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICIES = [
    ("Exo (Stereo)", "No Gaze", "#7fc0a3"),
    ("Ego + Wrist", "Ego + Wrist", "#5c8fc5"),
    ("AVF", "AVF", "url(#avf-hatch)"),
]
METRICS = {
    "progression": ("Task progression", "Task Progression"),
    "grasp": ("First-grasp success", "First-Grasp Success"),
    "success": ("Full-task success", "Success Rate"),
}


def values():
    with (ROOT / "data/distractor-results.csv").open(newline="") as source:
        rows = list(csv.DictReader(source))
    result = {}
    for row in rows:
        stages = [
            Fraction(row[f"Subtask {i}"])
            for i in range(1, 4)
            if row[f"Subtask {i}"] != "–"
        ]
        result[row["task"], row["Policy"]] = {
            "progression": sum(stages) / len(stages) * 100,
            "grasp": stages[0] * 100,
            "success": Fraction(row["Success (complete)"]) * 100,
        }
    return result


def render(metric, mobile, data, defs):
    width = 320 if mobile else 520
    left, right = (42, 314) if mobile else (48, 508)
    centers = [76, 144, 212, 280] if mobile else [105, 240, 345, 450]
    bar_width, stride = (14, 16) if mobile else (24, 27)
    groups = ["Average", "Wrench", "Tea", "Tape"]
    rows = []
    for task in groups:
        rows.append([
            sum(data[t, policy][metric] for t in ["wrench", "tea", "tape"]) / 3
            if task == "Average" else data[task.lower(), policy][metric]
            for policy, _, _ in POLICIES
        ])
    description = " ".join(
        f"{task}: " + ", ".join(
            f"{label} {float(value):.1f}%"
            for value, (_, label, _) in zip(row, POLICIES)
        ) + "."
        for task, row in zip(groups, rows)
    )
    svg = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="250" viewBox="0 0 {width} 250" role="img" aria-labelledby="title desc">',
        f'<title id="title">Distractor objects: {METRICS[metric][0]}</title>',
        f'<desc id="desc">{escape(description)} 25 trials per task and policy. Average weights tasks equally. Values above bars are rounded; bar heights use exact fractions.</desc>',
        defs,
        f'<rect width="{width}" height="250" fill="#fff"/>',
        '<g transform="translate(0 -24)">',
        '<g class="grid">',
        *[f'<line x1="{left}" y1="{y}" x2="{right}" y2="{y}"/>' for y in [60, 96, 132, 168]],
        '</g><g class="axis">',
        f'<line x1="{left}" y1="60" x2="{left}" y2="204"/>',
        f'<line x1="{left}" y1="204" x2="{right}" y2="204"/>',
        f'<line x1="{112 if mobile else 171}" y1="68" x2="{112 if mobile else 171}" y2="204" stroke="#888" stroke-width="2"/>',
        '</g><g class="axis-label" text-anchor="end">',
        *[f'<text x="{left-6}" y="{y+4}">{pct}%</text>' for y, pct in [(60, 100), (96, 75), (132, 50), (168, 25), (204, 0)]],
        '</g>',
    ]
    if not mobile:
        svg.append(f'<text class="axis-label" text-anchor="middle" transform="translate(13 132) rotate(-90)">{METRICS[metric][1]}</text>')
    for task, center, row in zip(groups, centers, rows):
        svg.append(f'<g data-task="{task}">')
        for offset, value, (_, label, fill) in zip([-1, 0, 1], row, POLICIES):
            x = center + offset * stride
            height = float(value) * 1.44
            y = 204 - height
            svg.append(
                f'<rect data-policy="{escape(label)}" data-value="{float(value):.6f}" '
                f'x="{x-bar_width/2:g}" y="{y:.6f}" width="{bar_width}" height="{height:.6f}" fill="{fill}">'
                f'<title>{escape(label)}: {float(value):.1f}%</title></rect>'
            )
            svg.append(f'<text class="value" x="{x}" y="{y-5:.6f}">{float(value):.0f}</text>')
        svg.append(f'<text class="task-label" x="{center}" y="225" text-anchor="middle">{task}</text></g>')
    svg.append('</g><g class="legend">')
    for x, (_, label, fill) in zip([30, 130, 256] if mobile else [110, 226, 366], POLICIES):
        svg.append(f'<rect x="{x}" y="228" width="12" height="12" fill="{fill}"/>')
        svg.append(f'<text x="{x+19}" y="239">{escape(label)}</text>')
    svg.append('</g></svg>')
    suffix = "-mobile" if mobile else ""
    (ROOT / f"images/figure_distractor_{metric}{suffix}.svg").write_text("\n".join(svg) + "\n")


def main():
    template = (ROOT / "images/figure_sim.svg").read_text()
    defs = "<defs>" + template.split("<defs>", 1)[1].split("</defs>", 1)[0] + "</defs>"
    data = values()
    for metric in METRICS:
        for mobile in [False, True]:
            render(metric, mobile, data, defs)


if __name__ == "__main__":
    main()
