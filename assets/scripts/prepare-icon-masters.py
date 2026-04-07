#!/usr/bin/env python3

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_PATH = REPO_ROOT / "assets/source/original/gemini-generated-icon.png"
MASTER_DIR = REPO_ROOT / "assets/source/master"
CANVAS_SIZE = 1536
CROP_BOX = (360, 360, 1688, 1688)
CENTER_RADIUS = 200
CENTER_CORE_RADIUS = 96
MIN_COMPONENT_AREA = 320


def build_raw_foreground_mask(crop: Image.Image) -> Image.Image:
    mask = Image.new("L", crop.size, 0)
    source_pixels = crop.load()
    mask_pixels = mask.load()

    for y in range(crop.size[1]):
        for x in range(crop.size[0]):
            red, green, blue, _ = source_pixels[x, y]
            maximum = max(red, green, blue)
            minimum = min(red, green, blue)
            luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
            saturation = maximum - minimum
            alpha = 0

            if luminance > 135:
                alpha = 255
            elif saturation > 42 and luminance > 58:
                alpha = 255
            elif saturation > 28 and luminance > 88:
                alpha = 220
            elif saturation > 18 and luminance > 110:
                alpha = 180

            mask_pixels[x, y] = alpha

    return mask


def remove_small_components(mask: Image.Image) -> Image.Image:
    width, height = mask.size
    pixels = mask.load()
    keep_mask = Image.new("L", mask.size, 0)
    keep_pixels = keep_mask.load()
    visited = bytearray(width * height)

    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or pixels[x, y] < 96:
                continue

            queue: deque[tuple[int, int]] = deque([(x, y)])
            component: list[tuple[int, int]] = []
            visited[index] = 1

            while queue:
                current_x, current_y = queue.popleft()
                component.append((current_x, current_y))

                for next_x, next_y in (
                    (current_x - 1, current_y),
                    (current_x + 1, current_y),
                    (current_x, current_y - 1),
                    (current_x, current_y + 1),
                ):
                    if next_x < 0 or next_y < 0 or next_x >= width or next_y >= height:
                        continue

                    next_index = next_y * width + next_x
                    if visited[next_index] or pixels[next_x, next_y] < 96:
                        continue

                    visited[next_index] = 1
                    queue.append((next_x, next_y))

            if len(component) < MIN_COMPONENT_AREA:
                continue

            for keep_x, keep_y in component:
                keep_pixels[keep_x, keep_y] = pixels[keep_x, keep_y]

    return keep_mask


def build_center_preserving_alpha(mask: Image.Image) -> Image.Image:
    cleaned_mask = remove_small_components(mask)
    foreground = cleaned_mask.filter(ImageFilter.GaussianBlur(2.2))
    halo = cleaned_mask.filter(ImageFilter.GaussianBlur(34))
    alpha = Image.new("L", cleaned_mask.size, 0)
    alpha_pixels = alpha.load()
    foreground_pixels = foreground.load()
    halo_pixels = halo.load()
    center_x = cleaned_mask.size[0] / 2
    center_y = cleaned_mask.size[1] / 2

    for y in range(cleaned_mask.size[1]):
        for x in range(cleaned_mask.size[0]):
            distance = ((x - center_x) ** 2 + (y - center_y) ** 2) ** 0.5
            radial = max(0.0, 1.0 - distance / CENTER_RADIUS)
            center_core = max(0.0, 1.0 - distance / CENTER_CORE_RADIUS)
            halo_keep = int(halo_pixels[x, y] * (radial**0.88) * 0.92)
            center_keep = int(255 * (center_core**1.35) * 0.42)
            alpha_pixels[x, y] = max(foreground_pixels[x, y], halo_keep, center_keep)

    return alpha


def center_on_canvas(image: Image.Image) -> Image.Image:
    alpha_bbox = image.getchannel("A").getbbox()
    if alpha_bbox is None:
        return image

    trimmed = image.crop(alpha_bbox)
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    offset_x = (CANVAS_SIZE - trimmed.size[0]) // 2
    offset_y = (CANVAS_SIZE - trimmed.size[1]) // 2
    canvas.alpha_composite(trimmed, (offset_x, offset_y))
    return canvas


def extract_core(target_size: int) -> Image.Image:
    original = Image.open(SOURCE_PATH).convert("RGBA")
    crop = original.crop(CROP_BOX)
    alpha = build_center_preserving_alpha(build_raw_foreground_mask(crop))
    icon = crop.copy()
    icon.putalpha(alpha)
    bbox = alpha.getbbox()
    if bbox is None:
        raise RuntimeError("failed to compute icon alpha bounds")
    icon = icon.crop(bbox)
    icon.thumbnail((target_size, target_size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    offset_x = (CANVAS_SIZE - icon.size[0]) // 2
    offset_y = (CANVAS_SIZE - icon.size[1]) // 2
    canvas.alpha_composite(icon, (offset_x, offset_y))
    return center_on_canvas(canvas)


def vertical_overlay(start: tuple[int, int, int], end: tuple[int, int, int]) -> Image.Image:
    gradient = Image.linear_gradient("L").resize((CANVAS_SIZE, CANVAS_SIZE), Image.Resampling.BICUBIC)
    return ImageOps.colorize(gradient, start, end).convert("RGBA")


def shadow_for(source: Image.Image, blur: float, opacity: float) -> Image.Image:
    alpha = source.getchannel("A").filter(ImageFilter.GaussianBlur(blur))
    shadow = Image.new("RGBA", source.size, (0, 0, 0, 0))
    shadow.putalpha(alpha.point(lambda value: int(value * opacity)))
    return shadow


def build_launcher_tile(core: Image.Image, core_compact: Image.Image) -> Image.Image:
    tile = vertical_overlay((10, 18, 25), (18, 36, 41))
    panel = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(panel)
    draw.rounded_rectangle(
        (96, 96, CANVAS_SIZE - 96, CANVAS_SIZE - 96),
        radius=290,
        fill=(15, 26, 34, 172),
        outline=(145, 165, 176, 54),
        width=8,
    )
    tile.alpha_composite(panel)
    tile.alpha_composite(shadow_for(core_compact, 26, 0.42), (12, 18))
    tile.alpha_composite(core_compact)
    return tile


def build_maskable_icon(core: Image.Image) -> Image.Image:
    maskable = vertical_overlay((10, 18, 25), (15, 31, 36))
    maskable.alpha_composite(shadow_for(core, 22, 0.34), (12, 18))
    maskable.alpha_composite(core)
    return maskable


def build_favicon_source(core: Image.Image) -> Image.Image:
    alpha = core.getchannel("A")
    strong_alpha = alpha.point(
        lambda value: 0 if value < 118 else min(255, int((value - 118) * 255 / (255 - 118)))
    ).filter(ImageFilter.GaussianBlur(0.8))
    alpha_bbox = strong_alpha.getbbox()
    if alpha_bbox is None:
        raise RuntimeError("failed to compute favicon alpha bounds")

    favicon = core.copy()
    favicon.putalpha(strong_alpha)
    trimmed = favicon.crop(alpha_bbox)
    trimmed.thumbnail((1320, 1320), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    offset_x = (CANVAS_SIZE - trimmed.size[0]) // 2
    offset_y = (CANVAS_SIZE - trimmed.size[1]) // 2
    canvas.alpha_composite(trimmed, (offset_x, offset_y))
    return canvas


def write_master_assets() -> None:
    MASTER_DIR.mkdir(parents=True, exist_ok=True)

    core = extract_core(1180)
    core_compact = extract_core(1280)
    tile = build_launcher_tile(core, core_compact)
    maskable = build_maskable_icon(core)
    favicon_source = build_favicon_source(core)

    core.save(MASTER_DIR / "icon-core.png")
    core_compact.save(MASTER_DIR / "icon-core-compact.png")
    favicon_source.save(MASTER_DIR / "favicon-source.png")
    tile.save(MASTER_DIR / "icon-tile.png")
    maskable.save(MASTER_DIR / "icon-maskable.png")
    vertical_overlay((10, 18, 25), (15, 31, 36)).save(MASTER_DIR / "android-adaptive-background.png")

    foreground = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    foreground.alpha_composite(shadow_for(core, 18, 0.28), (10, 14))
    foreground.alpha_composite(core)
    foreground.save(MASTER_DIR / "android-adaptive-foreground.png")

    for name in ("icon-core.png", "icon-core-compact.png"):
        alpha_bbox = Image.open(MASTER_DIR / name).convert("RGBA").getchannel("A").getbbox()
        print(f"{name}: bbox={alpha_bbox}")


if __name__ == "__main__":
    write_master_assets()
