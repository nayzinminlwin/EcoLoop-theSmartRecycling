from __future__ import annotations

import hashlib
import io
from dataclasses import dataclass
from typing import Any

from PIL import Image, UnidentifiedImageError

from ecoloop_vision.domain.models import Box, ProcessingInput


@dataclass(frozen=True)
class CropMetadata:
    source_object_id: str
    source_box: Box
    crop_box: Box
    padding_ratio: float
    source_width: int
    source_height: int
    crop_width: int
    crop_height: int


def decode_image(content: bytes, content_type: str) -> ProcessingInput:
    if not content:
        raise ValueError("Image content must not be empty")
    try:
        with Image.open(io.BytesIO(content)) as image:
            image.verify()
        with Image.open(io.BytesIO(content)) as image:
            width, height = image.size
    except (UnidentifiedImageError, OSError) as error:
        raise ValueError("Image content is not a decodable image") from error
    if width < 1 or height < 1:
        raise ValueError("Image dimensions must be positive")
    return ProcessingInput(
        content=content,
        content_type=content_type,
        sha256=hashlib.sha256(content).hexdigest(),
        width=width,
        height=height,
    )


def crop_candidate(
    image: ProcessingInput,
    *,
    object_id: str,
    box: Box,
    padding_ratio: float = 0.1,
    max_padding_ratio: float = 0.25,
) -> tuple[ProcessingInput, CropMetadata]:
    if not 0 <= padding_ratio <= max_padding_ratio:
        raise ValueError("Crop padding is outside the configured bound")
    if box[0] >= box[2] or box[1] >= box[3]:
        raise ValueError("Candidate box must have positive area")
    width = box[2] - box[0]
    height = box[3] - box[1]
    crop_box = (
        max(0.0, box[0] - width * padding_ratio),
        max(0.0, box[1] - height * padding_ratio),
        min(float(image.width), box[2] + width * padding_ratio),
        min(float(image.height), box[3] + height * padding_ratio),
    )
    with Image.open(io.BytesIO(image.content)) as source:
        cropped = source.crop(tuple(round(value) for value in crop_box))
        output = io.BytesIO()
        format_name = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}.get(image.content_type)
        if format_name is None:
            raise ValueError("Unsupported image content type for crop")
        cropped.save(output, format=format_name)
    crop_content = output.getvalue()
    crop = decode_image(crop_content, image.content_type)
    return crop, CropMetadata(
        source_object_id=object_id,
        source_box=box,
        crop_box=crop_box,
        padding_ratio=padding_ratio,
        source_width=image.width,
        source_height=image.height,
        crop_width=crop.width,
        crop_height=crop.height,
    )


def original_box(
    *,
    x: float,
    y: float,
    width: float,
    height: float,
    source_width: int,
    source_height: int,
    original_width: int,
    original_height: int,
    letterbox: dict[str, float] | None = None,
) -> Box:
    values = (x, y, width, height)
    if any(not isinstance(value, (int, float)) or not float(value) == float(value) for value in values):
        raise ValueError("Detection geometry must be finite")
    if width <= 0 or height <= 0 or source_width < 1 or source_height < 1:
        raise ValueError("Detection geometry must have positive area")
    if letterbox is None:
        scale_x = original_width / source_width
        scale_y = original_height / source_height
        left = x * scale_x
        top = y * scale_y
        right = (x + width) * scale_x
        bottom = (y + height) * scale_y
    else:
        scale = letterbox.get("scale")
        pad_x = letterbox.get("pad_x", 0.0)
        pad_y = letterbox.get("pad_y", 0.0)
        if (
            not isinstance(scale, (int, float))
            or not float(scale) == float(scale)
            or scale <= 0
        ):
            raise ValueError("Letterbox scale must be positive")
        if any(
            not isinstance(value, (int, float)) or not float(value) == float(value)
            for value in (pad_x, pad_y)
        ):
            raise ValueError("Letterbox padding must be finite")
        left = (x - pad_x) / scale
        top = (y - pad_y) / scale
        right = (x + width - pad_x) / scale
        bottom = (y + height - pad_y) / scale
    result = (
        max(0.0, min(float(original_width), left)),
        max(0.0, min(float(original_height), top)),
        max(0.0, min(float(original_width), right)),
        max(0.0, min(float(original_height), bottom)),
    )
    if result[0] >= result[2] or result[1] >= result[3]:
        raise ValueError("Detection geometry has no visible area")
    return result
