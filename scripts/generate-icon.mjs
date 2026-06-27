import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const size = 512;
const pixels = new Uint8Array(size * size * 4);

function setPixel(x, y, rgba) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  pixels[i] = rgba[0];
  pixels[i + 1] = rgba[1];
  pixels[i + 2] = rgba[2];
  pixels[i + 3] = rgba[3];
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    Math.round(a[3] + (b[3] - a[3]) * t)
  ];
}

function fillRoundedRect(x0, y0, w, h, r, top, bottom) {
  for (let y = Math.floor(y0); y < y0 + h; y += 1) {
    for (let x = Math.floor(x0); x < x0 + w; x += 1) {
      const dx = x < x0 + r ? x0 + r - x : x > x0 + w - r ? x - (x0 + w - r) : 0;
      const dy = y < y0 + r ? y0 + r - y : y > y0 + h - r ? y - (y0 + h - r) : 0;
      if (dx * dx + dy * dy <= r * r) {
        setPixel(x, y, mix(top, bottom, (y - y0) / h));
      }
    }
  }
}

function fillCircle(cx, cy, radius, color, highlight = null) {
  for (let y = Math.floor(cy - radius); y <= cy + radius; y += 1) {
    for (let x = Math.floor(cx - radius); x <= cx + radius; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= radius) {
        let px = color;
        if (highlight) {
          const shine = Math.max(0, 1 - Math.hypot(x - highlight[0], y - highlight[1]) / radius);
          px = mix(color, highlight[2], shine * 0.72);
        }
        setPixel(x, y, px);
      }
    }
  }
}

function strokeLine(x0, y0, x1, y1, width, color) {
  const minX = Math.floor(Math.min(x0, x1) - width);
  const maxX = Math.ceil(Math.max(x0, x1) + width);
  const minY = Math.floor(Math.min(y0, y1) - width);
  const maxY = Math.ceil(Math.max(y0, y1) + width);
  const vx = x1 - x0;
  const vy = y1 - y0;
  const len2 = vx * vx + vy * vy;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const t = Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / len2));
      const px = x0 + vx * t;
      const py = y0 + vy * t;
      if (Math.hypot(x - px, y - py) <= width / 2) {
        setPixel(x, y, color);
      }
    }
  }
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

fillRoundedRect(28, 28, 456, 456, 94, [34, 42, 45, 255], [16, 20, 22, 255]);
fillRoundedRect(58, 58, 396, 396, 64, [222, 177, 103, 255], [196, 141, 65, 255]);

for (let i = 0; i < 9; i += 1) {
  const p = 112 + i * 36;
  strokeLine(112, p, 400, p, 3, [82, 56, 31, 210]);
  strokeLine(p, 112, p, 400, 3, [82, 56, 31, 210]);
}

fillCircle(256, 256, 16, [20, 18, 16, 255]);
fillCircle(184, 184, 52, [10, 10, 10, 255], [92, 92, 88, 255]);
fillCircle(332, 184, 52, [242, 246, 244, 255], [255, 255, 255, 255]);
fillCircle(332, 328, 48, [50, 122, 125, 245], [110, 206, 210, 255]);

strokeLine(175, 262, 337, 262, 18, [245, 248, 244, 245]);
strokeLine(256, 172, 256, 352, 18, [245, 248, 244, 245]);
strokeLine(205, 214, 307, 214, 14, [245, 248, 244, 245]);
strokeLine(214, 310, 300, 310, 14, [245, 248, 244, 245]);

const raw = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y += 1) {
  raw[y * (size * 4 + 1)] = 0;
  for (let x = 0; x < size * 4; x += 1) {
    raw[y * (size * 4 + 1) + 1 + x] = pixels[y * size * 4 + x];
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8;
ihdr[9] = 6;

writeFileSync(
  "src-tauri/icons/icon.png",
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ])
);
