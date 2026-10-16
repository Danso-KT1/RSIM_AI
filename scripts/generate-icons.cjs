const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function createPngBuffer(width, height, isMaskable = false) {
  // Scanlines: height rows, each: 1 filter byte (0) + width * 4 RGBA bytes
  const rowLen = 1 + width * 4;
  const rawData = Buffer.alloc(rowLen * height);

  const cx = width / 2;
  const cy = height / 2;
  const scale = width / 512;
  const safeScale = isMaskable ? 0.75 : 0.9;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLen;
    rawData[rowOffset] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Base gradient: from dark slate #0f172a (top left) to deep emerald #064e3b (center) to rich emerald #047857 (bottom right)
      const gradT = (x / width + y / height) / 2;
      let r = Math.round(15 * (1 - gradT) + 4 * gradT);
      let g = Math.round(23 * (1 - gradT) + 120 * gradT);
      let b = Math.round(42 * (1 - gradT) + 87 * gradT);
      let a = 255;

      const dx = (x - cx) / (scale * safeScale);
      const dy = (y - cy) / (scale * safeScale);
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Central Shield/Medallion Circle (radius 155 in 512 scale)
      if (dist < 155) {
        // Inner circle
        const circleGrad = (dx + dy) / 310 + 0.5;
        r = Math.round(6 * (1 - circleGrad) + 16 * circleGrad);
        g = Math.round(78 * (1 - circleGrad) + 185 * circleGrad);
        b = Math.round(59 * (1 - circleGrad) + 129 * circleGrad);

        // Gold Ring border
        if (dist > 146 && dist < 155) {
          r = 245; g = 158; b = 11; // Gold amber-500
        }
      }

      // Pediment / Triangle roof: y between -120 and -80, x within triangle
      if (dy >= -120 && dy <= -75) {
        const roofW = (dy - -120) * 1.8;
        if (Math.abs(dx) <= roofW) {
          r = 251; g = 191; b = 36; // Amber gold
        }
      }

      // Architrave beam
      if (dy >= -72 && dy <= -60 && Math.abs(dx) <= 90) {
        r = 255; g = 255; b = 255; // White beam
      }

      // 4 Pillars
      if (dy >= -55 && dy <= 30) {
        // Pillar 1: dx between -75 and -55
        // Pillar 2: dx between -35 and -15
        // Pillar 3: dx between 15 and 35
        // Pillar 4: dx between 55 and 75
        const inPillar =
          (dx >= -75 && dx <= -55) ||
          (dx >= -35 && dx <= -15) ||
          (dx >= 15 && dx <= 35) ||
          (dx >= 55 && dx <= 75);
        if (inPillar) {
          r = 52; g = 211; b = 153; // Emerald-400
        }
      }

      // Base plinth
      if (dy >= 33 && dy <= 50 && Math.abs(dx) <= 95) {
        r = 245; g = 158; b = 11; // Gold plinth
      }

      // Star in pediment
      const starDist = Math.sqrt(dx * dx + (dy - -95) * (dy - -95));
      if (starDist < 9) {
        r = 255; g = 255; b = 255;
      }

      // Quill / Pen writing accent
      if (dx >= 40 && dx <= 110 && dy >= 40 && dy <= 95) {
        const lineDist = Math.abs((dy - 40) - 0.7 * (dx - 40));
        if (lineDist < 9) {
          r = 251; g = 191; b = 36;
        }
      }

      // Outer border rounded box highlight (if not maskable)
      if (!isMaskable) {
        const boxX = Math.abs(x - cx);
        const boxY = Math.abs(y - cy);
        const maxEdge = Math.max(boxX, boxY);
        if (maxEdge > width * 0.44 && maxEdge < width * 0.455) {
          r = Math.min(255, r + 40);
          g = Math.min(255, g + 80);
          b = Math.min(255, b + 60);
        }
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  // PNG Header
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT chunk
  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve(__dirname, '../public');

// 1. pwa-192x192.png
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPngBuffer(192, 192, false));
console.log('Created pwa-192x192.png');

// 2. pwa-512x512.png
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPngBuffer(512, 512, false));
console.log('Created pwa-512x512.png');

// 3. pwa-maskable-512x512.png (padded safe zone)
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPngBuffer(512, 512, true));
console.log('Created pwa-maskable-512x512.png');

// 4. apple-touch-icon.png (180x180 PNG required for iOS Safari)
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPngBuffer(180, 180, false));
console.log('Created apple-touch-icon.png');

// 5. favicon.ico (192 or 32 PNG renamed to ico or standard)
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPngBuffer(64, 64, false));
console.log('Created favicon.ico');

console.log('All PWA assets successfully generated!');
