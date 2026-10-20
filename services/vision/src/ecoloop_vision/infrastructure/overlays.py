from __future__ import annotations

import io
from pathlib import Path

from PIL import Image, ImageDraw

from ecoloop_vision.domain.resolution import ResolvedObject


def render_overlay(content: bytes, objects: tuple[ResolvedObject, ...], output_path: Path) -> None:
    with Image.open(io.BytesIO(content)) as image:
        canvas = image.convert("RGB")
        draw = ImageDraw.Draw(canvas)
        for item in objects:
            x1, y1, x2, y2 = item.box
            color = "green" if item.eligibility == "eligible" else (
                "orange" if item.eligibility == "unresolved" else "red"
            )
            draw.rectangle((x1, y1, x2, y2), outline=color, width=3)
            draw.text((x1 + 2, y1 + 2), f"{item.object_id}: {item.resolution}", fill=color)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(output_path, format="PNG")
