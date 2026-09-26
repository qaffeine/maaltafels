"""Draw the app icon (a big × on green) as PNG files, using only the standard library.

Run from the project folder:  python3 tools/make_icons.py
"""
import math
import struct
import zlib

GREEN = (0x2D, 0x75, 0x43)
SHADOW = (0x1F, 0x5A, 0x32)
CREAM = (0xFF, 0xF6, 0xDC)

# The × stays inside the central 80% circle, so iOS/Android masks never cut it.
ARM_FROM, ARM_TO = 0.30, 0.70
THICKNESS = 0.13
SHADOW_OFFSET = 0.025
SAMPLES = 3  # anti-aliasing: 3×3 samples per pixel


def dist_to_segment(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def in_cross(x, y):
    r = THICKNESS / 2
    return (dist_to_segment(x, y, ARM_FROM, ARM_FROM, ARM_TO, ARM_TO) <= r or
            dist_to_segment(x, y, ARM_TO, ARM_FROM, ARM_FROM, ARM_TO) <= r)


def pixel(x, y, size):
    acc = [0.0, 0.0, 0.0]
    for sy in range(SAMPLES):
        for sx in range(SAMPLES):
            u = (x + (sx + 0.5) / SAMPLES) / size
            v = (y + (sy + 0.5) / SAMPLES) / size
            if in_cross(u, v):
                c = CREAM
            elif in_cross(u, v - SHADOW_OFFSET):
                c = SHADOW
            else:
                c = GREEN
            for i in range(3):
                acc[i] += c[i]
    n = SAMPLES * SAMPLES
    return bytes(round(a / n) for a in acc)


def write_png(path, size):
    rows = []
    for y in range(size):
        rows.append(b"\x00" + b"".join(pixel(x, y, size) for x in range(size)))
    raw = zlib.compress(b"".join(rows), 9)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))

    png = (b"\x89PNG\r\n\x1a\n" +
           chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)) +
           chunk(b"IDAT", raw) +
           chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)
    print("wrote", path)


if __name__ == "__main__":
    write_png("icons/apple-touch-icon.png", 180)
    write_png("icons/icon-192.png", 192)
    write_png("icons/icon-512.png", 512)
