#!/usr/bin/env python3
import argparse
import binascii
import json
import os
import re
import struct
import time
import zlib
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED


# --- PNG generation (rounded icon with letter 'D') ---
def _png_chunk(tag: bytes, data: bytes) -> bytes:
  return struct.pack(
    ">I", len(data)
  ) + tag + data + struct.pack(
    ">I", (binascii.crc32(tag + data) & 0xFFFFFFFF)
  )


def _new_raw_rgba(size: int) -> bytearray:
  # Each row starts with PNG filter byte 0
  return bytearray((1 + 4 * size) * size)


def _set_px(raw: bytearray, size: int, x: int, y: int, r: int, g: int, b: int, a: int = 255) -> None:
  if x < 0 or y < 0 or x >= size or y >= size:
    return
  row_start = y * (1 + 4 * size)
  raw[row_start] = 0  # filter type 0 per row
  i = row_start + 1 + 4 * x
  raw[i + 0] = r
  raw[i + 1] = g
  raw[i + 2] = b
  raw[i + 3] = a


def _draw_rounded_rect(raw: bytearray, size: int, radius: int, r: int, g: int, b: int, a: int = 255) -> None:
  s = size
  rad2 = radius * radius
  for y in range(s):
    for x in range(s):
      in_core = (radius <= x < s - radius) or (radius <= y < s - radius)
      if in_core:
        _set_px(raw, s, x, y, r, g, b, a)
        continue
      # corners
      cx = radius if x < radius else (s - 1 - radius)
      cy = radius if y < radius else (s - 1 - radius)
      dx = x - cx
      dy = y - cy
      if dx * dx + dy * dy <= rad2:
        _set_px(raw, s, x, y, r, g, b, a)


def _draw_letter_d(raw: bytearray, size: int, fg: tuple[int, int, int, int]) -> None:
  r, g, b, a = fg
  s = size
  # Proportions tuned for small sizes too
  margin = max(1, int(round(0.18 * s)))
  bar = max(1, int(round(0.22 * s)))
  top = margin
  bottom = s - margin - 1
  cy = (top + bottom) / 2.0
  radius = (bottom - top + 1) / 2.0
  cx = margin + bar  # center of semicircle

  for y in range(top, bottom + 1):
    for x in range(margin, s - margin):
      # Left vertical bar
      if x <= margin + bar:
        _set_px(raw, s, x, y, r, g, b, a)
        continue
      # Right half-disk
      dx = x - cx
      dy = y - cy
      if dx >= 0 and (dx * dx + dy * dy) <= radius * radius:
        _set_px(raw, s, x, y, r, g, b, a)


def write_logo_png(path: Path, size: int, bg_rgb: tuple[int, int, int], fg_rgb: tuple[int, int, int], corner_frac: float = 0.23) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  s = size
  raw = _new_raw_rgba(s)
  radius = max(1, int(round(s * corner_frac)))
  # Background rounded rectangle
  _draw_rounded_rect(raw, s, radius, bg_rgb[0], bg_rgb[1], bg_rgb[2], 255)
  # Letter 'D' overlay
  _draw_letter_d(raw, s, (fg_rgb[0], fg_rgb[1], fg_rgb[2], 255))

  png_sig = b"\x89PNG\r\n\x1a\n"
  ihdr = struct.pack(
    ">IIBBBBB",
    s,
    s,
    8,   # bit depth
    6,   # color type RGBA
    0,   # compression
    0,   # filter
    0,   # interlace
  )
  idat = zlib.compress(bytes(raw))
  with open(path, "wb") as f:
    f.write(png_sig)
    f.write(_png_chunk(b"IHDR", ihdr))
    f.write(_png_chunk(b"IDAT", idat))
    f.write(_png_chunk(b"IEND", b""))


# --- Helpers ---
def load_manifest(root: Path) -> dict:
  with open(root / "manifest.json", "r", encoding="utf-8") as f:
    return json.load(f)


def save_manifest(root: Path, manifest: dict) -> None:
  # Keep 2-space indentation to match existing file style
  with open(root / "manifest.json", "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2)
    f.write("\n")


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
  v = hex_color.lstrip('#')
  if len(v) == 3:
    v = ''.join(c + c for c in v)
  return int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16)


def ensure_icons(root: Path, bg_hex: str = "#1e90ff", fg_hex: str = "#ffffff", overwrite: bool = True) -> None:
  br, bg, bb = hex_to_rgb(bg_hex)
  fr, fg, fb = hex_to_rgb(fg_hex)
  sizes = [16, 32, 48, 128]
  for s in sizes:
    out = root / "icons" / f"icon{s}.png"
    if overwrite or not out.exists():
      write_logo_png(out, s, (br, bg, bb), (fr, fg, fb))


def ensure_manifest_icons(manifest: dict) -> dict:
  icons = manifest.get("icons") or {}
  icons.update({
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
  })
  manifest["icons"] = icons

  action = manifest.get("action") or {}
  default_icon = action.get("default_icon") or {}
  default_icon.update({
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
  })
  action["default_icon"] = default_icon
  manifest["action"] = action
  return manifest


def bump_version_str(version: str, kind: str) -> str:
  parts = [int(p) for p in re.findall(r"\d+", version)]
  while len(parts) < 3:
    parts.append(0)
  major, minor, patch = parts[:3]
  if kind == "major":
    major += 1; minor = 0; patch = 0
  elif kind == "minor":
    minor += 1; patch = 0
  else:
    patch += 1
  return f"{major}.{minor}.{patch}"


def slugify(text: str) -> str:
  text = text.lower()
  text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
  return re.sub(r"-+", "-", text)


def build_zip(root: Path, out_dir: Path, zip_name: str) -> Path:
  out_dir.mkdir(parents=True, exist_ok=True)
  zip_path = out_dir / zip_name
  include_paths = []
  for p in root.iterdir():
    if p.name in {".git", ".github", ".DS_Store"}:
      continue
    if p.suffix in {".zip"}:
      continue
    include_paths.append(p)

  with ZipFile(zip_path, "w", compression=ZIP_DEFLATED) as zf:
    for p in include_paths:
      if p.is_dir():
        for fp in p.rglob("*"):
          if fp.is_dir():
            continue
          if any(part.startswith('.') for part in fp.relative_to(root).parts):
            continue
          zf.write(fp, fp.relative_to(root).as_posix())
      else:
        zf.write(p, p.name)
  return zip_path


def main():
  parser = argparse.ArgumentParser(description="Prepare Chrome extension release: generate icons, ensure manifest, create ZIP")
  parser.add_argument("--bump", choices=["patch", "minor", "major"], help="Bump manifest version before packaging")
  parser.add_argument("--bg-color", default="#1e90ff", help="Background hex color for icons (default: #1e90ff)")
  parser.add_argument("--fg-color", default="#ffffff", help="Letter color for icons (default: #ffffff)")
  parser.add_argument("--no-overwrite", action="store_true", help="Do not overwrite existing icons")
  parser.add_argument("--out-dir", default="dist", help="Output directory for the ZIP (default: dist)")
  args = parser.parse_args()

  root = Path(__file__).resolve().parent
  manifest = load_manifest(root)

  # Generate icons (rounded with 'D')
  ensure_icons(root, args.bg_color, args.fg_color, overwrite=(not args.no_overwrite))

  # Ensure manifest has icons/default_icon
  manifest = ensure_manifest_icons(manifest)

  # Optional version bump
  original_version = manifest.get("version", "0.0.0")
  if args.bump:
    manifest["version"] = bump_version_str(original_version, args.bump)

  save_manifest(root, manifest)

  # Build ZIP
  name = manifest.get("name", "extension")
  version = manifest.get("version", original_version)
  safe_name = slugify(name)
  timestamp = int(time.time())
  zip_name = f"{safe_name}-{version}.zip"
  out_zip = build_zip(root, Path(args.out_dir), zip_name)

  print("Prepared release:")
  print(f"  name:       {name}")
  print(f"  version:    {version}")
  print(f"  icons:      icons/icon16.png, icon32.png, icon48.png, icon128.png (rounded, 'D')")
  print(f"  output:     {out_zip}")


if __name__ == "__main__":
  main()


