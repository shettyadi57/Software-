#!/usr/bin/env python3
"""Generate simple placeholder PNG icons for the AEGIS extension."""
import os
import struct
import zlib

def make_png(size, color=(37, 99, 235)):
    """Create a minimal solid-color PNG."""
    def pack_chunk(chunk_type, data):
        c = chunk_type + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = pack_chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))

    raw = b''
    for _ in range(size):
        row = b'\x00'
        for _ in range(size):
            row += bytes(color)
        raw += row

    compressed = zlib.compress(raw)
    idat = pack_chunk(b'IDAT', compressed)
    iend = pack_chunk(b'IEND', b'')
    return header + ihdr + idat + iend

os.makedirs('icons', exist_ok=True)
for size in [16, 48, 128]:
    with open(f'icons/icon{size}.png', 'wb') as f:
        f.write(make_png(size))
    print(f"Created icons/icon{size}.png")
