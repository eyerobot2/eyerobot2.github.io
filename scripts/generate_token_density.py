#!/usr/bin/env python3
"""Generate the dense-versus-foveated stereo token-density diagram."""

from pathlib import Path


OUTPUT = Path(__file__).resolve().parents[1] / "images" / "token_density.svg"

IMAGE_WIDTH = 1600
IMAGE_HEIGHT = 1200
PYRAMID_LEVELS = 3
FOVEA_SIZE = 400
FOVEATED_TOKENS = 16
DENSE_PIXELS_PER_TOKEN = FOVEA_SIZE / FOVEATED_TOKENS

SVG_WIDTH = 800
SVG_HEIGHT = 240
FRAME_WIDTH = 232
FRAME_HEIGHT = FRAME_WIDTH * IMAGE_HEIGHT / IMAGE_WIDTH
FRAME_Y = 30


def line(x1, y1, x2, y2, css_class):
    return (
        f'<line x1="{x1:.3f}" y1="{y1:.3f}" '
        f'x2="{x2:.3f}" y2="{y2:.3f}" class="{css_class}"/>'
    )


def grid(x, y, width, height, columns, rows, css_class):
    elements = []
    for column in range(1, columns):
        grid_x = x + width * column / columns
        elements.append(line(grid_x, y, grid_x, y + height, css_class))
    for row in range(1, rows):
        grid_y = y + height * row / rows
        elements.append(line(x, grid_y, x + width, grid_y, css_class))
    return "\n".join(elements)


def frame(x):
    return (
        f'<rect x="{x}" y="{FRAME_Y}" width="{FRAME_WIDTH}" '
        f'height="{FRAME_HEIGHT}" class="image-frame"/>'
    )


def dense_eye(x):
    columns = int(IMAGE_WIDTH / DENSE_PIXELS_PER_TOKEN)
    rows = int(IMAGE_HEIGHT / DENSE_PIXELS_PER_TOKEN)
    return "\n".join(
        [
            frame(x),
            grid(
                x,
                FRAME_Y,
                FRAME_WIDTH,
                FRAME_HEIGHT,
                columns,
                rows,
                "dense-grid",
            ),
        ]
    )


def model_eye(x):
    return "\n".join(
        [
            frame(x),
            grid(
                x,
                FRAME_Y,
                FRAME_WIDTH,
                FRAME_HEIGHT,
                FOVEATED_TOKENS,
                FOVEATED_TOKENS,
                "model-grid",
            ),
        ]
    )


def pyramid_dimensions():
    dimensions = []
    for level in range(PYRAMID_LEVELS):
        fraction = level / (PYRAMID_LEVELS - 1)
        width = FOVEA_SIZE + fraction * (IMAGE_WIDTH - FOVEA_SIZE)
        height = FOVEA_SIZE + fraction * (IMAGE_HEIGHT - FOVEA_SIZE)
        dimensions.append((width, height))
    return dimensions


def foveated_eye(x):
    elements = [frame(x)]
    center_x = x + FRAME_WIDTH / 2
    center_y = FRAME_Y + FRAME_HEIGHT / 2

    # Draw broad levels first so the denser foveal grid remains visible.
    for level, (source_width, source_height) in reversed(
        list(enumerate(pyramid_dimensions(), start=1))
    ):
        width = FRAME_WIDTH * source_width / IMAGE_WIDTH
        height = FRAME_HEIGHT * source_height / IMAGE_HEIGHT
        level_x = center_x - width / 2
        level_y = center_y - height / 2
        elements.append(
            f'<rect x="{level_x:.3f}" y="{level_y:.3f}" width="{width:.3f}" '
            f'height="{height:.3f}" class="level-{level}-outline"/>'
        )
        elements.append(
            grid(
                level_x,
                level_y,
                width,
                height,
                FOVEATED_TOKENS,
                FOVEATED_TOKENS,
                f"level-{level}-grid",
            )
        )
    return "\n".join(elements)


def main():
    model_x = 12
    dense_x = 284
    foveated_x = 556
    model_per_eye = FOVEATED_TOKENS**2
    dense_columns = int(IMAGE_WIDTH / DENSE_PIXELS_PER_TOKEN)
    dense_rows = int(IMAGE_HEIGHT / DENSE_PIXELS_PER_TOKEN)
    dense_per_eye = dense_columns * dense_rows
    foveated_per_eye = PYRAMID_LEVELS * FOVEATED_TOKENS**2
    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{SVG_WIDTH}" height="{SVG_HEIGHT}"
     viewBox="0 0 {SVG_WIDTH} {SVG_HEIGHT}" role="img" aria-labelledby="title desc">
  <title id="title">Dense and foveated stereo token density</title>
  <desc id="desc">Three representative image grids compare the model's 16 by 16 image
    tokens, a 64 by 48 grid matching the fovea's effective token density, and
    three centered 16 by 16 pyramid levels at 400 by 400, 1000 by 800, and
    1600 by 1200 pixels. Counts beneath each grid include both stereo images.</desc>
  <style>
    text {{
      font-family: "Avenir Next", Avenir, "Open Sans", sans-serif;
      fill: #202020;
      letter-spacing: 0;
    }}
    .heading {{ font-size: 15px; font-weight: 500; text-anchor: middle; }}
    .image-frame {{ fill: #fafafa; stroke: #222; stroke-width: 0.8; }}
    .model-grid {{ stroke: #111; stroke-width: 0.45; opacity: 0.55; }}
    .dense-grid {{ stroke: #111; stroke-width: 0.28; opacity: 0.46; }}
    .level-3-grid {{ stroke: #111; stroke-width: 0.45; opacity: 0.22; }}
    .level-2-grid {{ stroke: #111; stroke-width: 0.45; opacity: 0.42; }}
    .level-1-grid {{ stroke: #111; stroke-width: 0.5; opacity: 0.75; }}
    .level-3-outline {{ fill: none; stroke: #111; stroke-width: 0.8; opacity: 0.5; }}
    .level-2-outline {{ fill: #fff; fill-opacity: 0.2; stroke: #111; stroke-width: 0.9; opacity: 0.7; }}
    .level-1-outline {{ fill: #fff; fill-opacity: 0.25; stroke: #111; stroke-width: 1; }}
    .count {{ font-size: 15px; font-weight: 500; text-anchor: middle; }}
    line, rect {{ vector-effect: non-scaling-stroke; }}
  </style>

  <text x="{model_x + FRAME_WIDTH / 2}" y="18" class="heading">Standard tokenization</text>
  {model_eye(model_x)}
  <text x="{model_x + FRAME_WIDTH / 2}" y="226" class="count">{model_per_eye * 2:,} tokens/stereo pair</text>

  <text x="{dense_x + FRAME_WIDTH / 2}" y="18" class="heading">Density-matched tokenization</text>
  {dense_eye(dense_x)}
  <text x="{dense_x + FRAME_WIDTH / 2}" y="226" class="count">{dense_per_eye * 2:,} tokens/stereo pair</text>

  <text x="{foveated_x + FRAME_WIDTH / 2}" y="18" class="heading">EyeRobot's tokenization</text>
  {foveated_eye(foveated_x)}
  <text x="{foveated_x + FRAME_WIDTH / 2}" y="226" class="count">{foveated_per_eye * 2:,} tokens/stereo pair</text>
</svg>
"""
    OUTPUT.write_text(svg, encoding="utf-8")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
