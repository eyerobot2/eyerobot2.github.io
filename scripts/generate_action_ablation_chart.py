#!/usr/bin/env python3
"""Render the supplied action-frame ablation in the existing sim chart style."""
from html import escape
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = [
    ("Average", "Task average", 74.3, 52.5, 102),
    ("tape", "Tape handover (random)", 79, 56, 208),
    ("pot", "Pot lid", 91, 58, 288),
    ("tiger", "Tiger (right half)", 98, 81, 368),
    ("tray", "Medical tray", 78, 45, 448),
    ("plate", "Plate in rack", 70, 55, 528),
    ("spoon", "Hang spoon", 30, 20, 608),
]


def main():
    template = (ROOT / "images/figure_sim.svg").read_text()
    # Reuse the exact fonts, hatch, axes, spacing, and 0–100% scale.
    header = template.split("  <!-- Simulation average:")[0]
    header = header.replace(
        "Simulation evaluation success rates",
        "Fixation-centric action frame ablation",
    ).replace(
        "Simulation average and six simulation task success rates for No Gaze, Ego plus Wrist, and AVF.",
        "Simulation success rates for AVF and world-relative actions. "
        + " ".join(f"{task}: {full}% versus {world}%." for _, task, full, world, _ in DATA),
    )
    groups = []
    for label, task, full, world, center in DATA:
        groups.append(f'  <g><title>{escape(task)}: AVF {full}%, world-relative actions {world}%</title>')
        for value, x, fill in (
            (world, center - 15, "#5c8fc5"),
            (full, center + 15, "url(#avf-hatch)"),
        ):
            height = value * 1.44
            y = 204 - height
            groups.append(
                f'    <rect x="{x-12}" y="{y:.3f}" width="24" height="{height:.3f}" fill="{fill}"/>'
            )
            groups.append(f'    <text class="value" x="{x}" y="{y-5:.3f}">{value}</text>')
        groups.append(f'    <text class="task-label" x="{center}" y="225" text-anchor="middle">{label}</text>')
        groups.append("  </g>")
    footer = """
  </g>
  <g class="legend">
    <rect x="180" y="228" width="12" height="12" fill="#5c8fc5"/>
    <text x="200" y="239">World-relative actions</text>
    <rect x="395" y="228" width="12" height="12" fill="url(#avf-hatch)"/>
    <text x="415" y="239">AVF</text>
  </g>
</svg>
"""
    (ROOT / "images/figure_action_ablation.svg").write_text(header + "\n".join(groups) + footer)


if __name__ == "__main__":
    main()
