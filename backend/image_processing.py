"""FR-32: trusted image decoding and purpose-specific WebP outputs.

Edit PRESETS to tune maximum dimensions and WebP quality (1–100).
No upscaling. Post/banner aspect ratios are preserved; avatars use a square crop.
"""
from dataclasses import dataclass
from io import BytesIO
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError

from image_schemas import MAX_IMAGE_BYTES

MAX_SOURCE_PIXELS = 25_000_000
Image.MAX_IMAGE_PIXELS = MAX_SOURCE_PIXELS


@dataclass(frozen=True)
class Preset:
    name: str
    width: int
    height: int
    quality: int


PRESETS = {
    "post": (Preset("preview", 600, 600, 78), Preset("expanded", 2000, 2000, 85)),
    "avatar": (Preset("avatar_small", 96, 96, 80), Preset("avatar_large", 384, 384, 85)),
    "banner": (Preset("banner", 1600, 1600, 82),),
}


@dataclass(frozen=True)
class Output:
    name: str
    data: bytes
    width: int
    height: int


def process_image(data: bytes, purpose: str, content_type: str) -> list[Output]:
    if purpose not in PRESETS or not 0 < len(data) <= MAX_IMAGE_BYTES:
        raise ValueError("Invalid image input.")
    formats = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as source:
                if (source.format != formats.get(content_type) or source.width * source.height > MAX_SOURCE_PIXELS
                        or getattr(source, "n_frames", 1) != 1):
                    raise ValueError("Choose a still image with at most 25 million pixels and a matching type.")
                source.load()
                ImageOps.exif_transpose(source, in_place=True)
                if purpose == "avatar":
                    edge = min(source.width, source.height,
                               max(p.width for p in PRESETS[purpose]), max(p.height for p in PRESETS[purpose]))
                    master = ImageOps.fit(source, (edge, edge), method=Image.Resampling.LANCZOS)
                else:
                    # Shrink before color conversion/copies to bound worker memory.
                    source.thumbnail((max(p.width for p in PRESETS[purpose]),
                                      max(p.height for p in PRESETS[purpose])), Image.Resampling.LANCZOS)
                    master = source
                pixels = master.convert("RGBA" if "A" in master.getbands() or "transparency" in master.info else "RGB")
                # Detach pixel data from all EXIF, comments, ICC and other source metadata.
                clean = Image.new(pixels.mode, pixels.size)
                clean.paste(pixels)
                outputs = []
                for preset in PRESETS[purpose]:
                    image = clean.copy()
                    image.thumbnail((preset.width, preset.height), Image.Resampling.LANCZOS)
                    buffer = BytesIO()
                    image.save(buffer, format="WEBP", quality=preset.quality, method=6)
                    encoded = buffer.getvalue()
                    if len(encoded) > MAX_IMAGE_BYTES:
                        raise ValueError("Processed image exceeds the storage limit.")
                    outputs.append(Output(preset.name, encoded, image.width, image.height))
                return outputs
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ValueError("This image could not be safely decoded.") from None
