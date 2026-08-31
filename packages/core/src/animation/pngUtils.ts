import * as zlib from "node:zlib";

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makePngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  const crcVal = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/**
 * Generate a valid RGBA PNG Buffer containing a 2D cartoon character sprite with transparent background.
 */
export function createCartoonCharacterSprite(
  width = 256,
  height = 256,
  primaryColor = { r: 255, g: 150, b: 0 } // Golden lion orange
): Buffer {
  const rowSize = width * 4 + 1;
  const raw = Buffer.alloc(rowSize * height);
  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.36;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    raw[rowOffset] = 0; // Filter 0 (None)
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Ears
      const ear1 = Math.sqrt((x - (cx - 55)) ** 2 + (y - (cy - 65)) ** 2);
      const ear2 = Math.sqrt((x - (cx + 55)) ** 2 + (y - (cy - 65)) ** 2);
      const isEar = ear1 < 26 || ear2 < 26;

      if (dist < radius || isEar) {
        // Eyes
        const eye1 = Math.sqrt((x - (cx - 32)) ** 2 + (y - (cy - 12)) ** 2);
        const eye2 = Math.sqrt((x - (cx + 32)) ** 2 + (y - (cy - 12)) ** 2);
        const pupil1 = Math.sqrt((x - (cx - 30)) ** 2 + (y - (cy - 10)) ** 2);
        const pupil2 = Math.sqrt((x - (cx + 30)) ** 2 + (y - (cy - 10)) ** 2);
        const highlight1 = Math.sqrt((x - (cx - 33)) ** 2 + (y - (cy - 14)) ** 2);
        const highlight2 = Math.sqrt((x - (cx + 27)) ** 2 + (y - (cy - 14)) ** 2);

        // Cheeks
        const cheek1 = Math.sqrt((x - (cx - 50)) ** 2 + (y - (cy + 22)) ** 2);
        const cheek2 = Math.sqrt((x - (cx + 50)) ** 2 + (y - (cy + 22)) ** 2);

        // Smile
        const smileCurve = (cy + 28) - (x - cx) ** 2 / 100;
        const isSmile = Math.abs(y - smileCurve) < 3.5 && Math.abs(x - cx) < 28 && y >= cy + 18;

        if (highlight1 < 3.5 || highlight2 < 3.5) {
          raw[pxOffset] = 255; raw[pxOffset + 1] = 255; raw[pxOffset + 2] = 255; raw[pxOffset + 3] = 255;
        } else if (pupil1 < 8 || pupil2 < 8) {
          raw[pxOffset] = 30; raw[pxOffset + 1] = 20; raw[pxOffset + 2] = 20; raw[pxOffset + 3] = 255;
        } else if (eye1 < 16 || eye2 < 16) {
          raw[pxOffset] = 255; raw[pxOffset + 1] = 255; raw[pxOffset + 2] = 255; raw[pxOffset + 3] = 255;
        } else if (cheek1 < 12 || cheek2 < 12) {
          raw[pxOffset] = 255; raw[pxOffset + 1] = 110; raw[pxOffset + 2] = 130; raw[pxOffset + 3] = 255;
        } else if (isSmile) {
          raw[pxOffset] = 190; raw[pxOffset + 1] = 30; raw[pxOffset + 2] = 40; raw[pxOffset + 3] = 255;
        } else {
          if (isEar) {
            raw[pxOffset] = primaryColor.r - 20;
            raw[pxOffset + 1] = primaryColor.g - 20;
            raw[pxOffset + 2] = primaryColor.b;
            raw[pxOffset + 3] = 255;
          } else {
            raw[pxOffset] = primaryColor.r;
            raw[pxOffset + 1] = primaryColor.g;
            raw[pxOffset + 2] = primaryColor.b;
            raw[pxOffset + 3] = 255;
          }
        }
      } else {
        // Transparent background
        raw[pxOffset] = 0;
        raw[pxOffset + 1] = 0;
        raw[pxOffset + 2] = 0;
        raw[pxOffset + 3] = 0;
      }
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = makePngChunk("IHDR", ihdrData);
  const compressed = zlib.deflateSync(raw);
  const idatChunk = makePngChunk("IDAT", compressed);
  const iendChunk = makePngChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Generate a colorful cartoon landscape background PNG.
 */
export function createCartoonBackground(
  width = 1280,
  height = 720,
  theme: "meadow" | "sunset" | "forest" | "sky" = "meadow"
): Buffer {
  const rowSize = width * 3 + 1; // RGB
  const raw = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    raw[rowOffset] = 0;
    const normY = y / height;

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      const normX = x / width;

      if (normY < 0.6) {
        if (theme === "sunset") {
          raw[pxOffset] = Math.round(255 - normY * 80);
          raw[pxOffset + 1] = Math.round(140 + normY * 60);
          raw[pxOffset + 2] = Math.round(180 + normY * 40);
        } else {
          raw[pxOffset] = Math.round(120 + normY * 80);
          raw[pxOffset + 1] = Math.round(190 + normY * 45);
          raw[pxOffset + 2] = 255;
        }

        const sunDist = Math.sqrt((x - width * 0.8) ** 2 + (y - height * 0.25) ** 2);
        if (sunDist < 60) {
          raw[pxOffset] = 255; raw[pxOffset + 1] = 240; raw[pxOffset + 2] = 120;
        }
      } else {
        const hillOffset = Math.sin(normX * Math.PI * 3) * 35;
        if (y > height * 0.6 + hillOffset) {
          raw[pxOffset] = 85;
          raw[pxOffset + 1] = Math.round(190 + normY * 30);
          raw[pxOffset + 2] = 60;
        } else {
          raw[pxOffset] = 110;
          raw[pxOffset + 1] = 175;
          raw[pxOffset + 2] = 90;
        }
      }
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 2; // RGB
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = makePngChunk("IHDR", ihdrData);
  const compressed = zlib.deflateSync(raw);
  const idatChunk = makePngChunk("IDAT", compressed);
  const iendChunk = makePngChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Generate a clean, dark editorial finance background PNG.
 */
export function createFinanceBackground(width = 1280, height = 720): Buffer {
  const rowSize = width * 3 + 1;
  const raw = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    raw[rowOffset] = 0;
    const normY = y / height;

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      const isGrid = x % 80 === 0 || y % 80 === 0;

      if (isGrid) {
        raw[pxOffset] = 20;
        raw[pxOffset + 1] = 45;
        raw[pxOffset + 2] = 80;
      } else {
        // Deep midnight gradient with subtle emerald tint
        raw[pxOffset] = Math.round(8 + normY * 6);
        raw[pxOffset + 1] = Math.round(18 + normY * 14);
        raw[pxOffset + 2] = Math.round(35 + normY * 20);
      }
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 2;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = makePngChunk("IHDR", ihdrData);
  const compressed = zlib.deflateSync(raw);
  const idatChunk = makePngChunk("IDAT", compressed);
  const iendChunk = makePngChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Generate a historical parchment / antique map background PNG.
 */
export function createHistoryBackground(width = 1280, height = 720): Buffer {
  const rowSize = width * 3 + 1;
  const raw = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    raw[rowOffset] = 0;
    const normY = y / height;

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      const vignette = Math.sqrt((x - width / 2) ** 2 + (y - height / 2) ** 2) / (width * 0.6);
      const vigFactor = Math.max(0.4, 1.0 - vignette * 0.5);

      // Warm aged parchment
      raw[pxOffset] = Math.round((55 + normY * 10) * vigFactor);
      raw[pxOffset + 1] = Math.round((35 + normY * 8) * vigFactor);
      raw[pxOffset + 2] = Math.round((22 + normY * 5) * vigFactor);
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 2;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = makePngChunk("IHDR", ihdrData);
  const compressed = zlib.deflateSync(raw);
  const idatChunk = makePngChunk("IDAT", compressed);
  const iendChunk = makePngChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Generate a cinematic deep blue/oceanic documentary background PNG.
 */
export function createDocumentaryBackground(width = 1280, height = 720): Buffer {
  const rowSize = width * 3 + 1;
  const raw = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    raw[rowOffset] = 0;
    const normY = y / height;

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      // Oceanic abyss gradient
      raw[pxOffset] = Math.round(4 + normY * 8);
      raw[pxOffset + 1] = Math.round(30 + normY * 35);
      raw[pxOffset + 2] = Math.round(65 + normY * 50);
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 2;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = makePngChunk("IHDR", ihdrData);
  const compressed = zlib.deflateSync(raw);
  const idatChunk = makePngChunk("IDAT", compressed);
  const iendChunk = makePngChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Generate a domain-appropriate background PNG.
 */
export function createDomainBackground(domain = "GENERAL", width = 1280, height = 720): Buffer {
  switch (domain.toUpperCase()) {
    case "FINANCE":
      return createFinanceBackground(width, height);
    case "HISTORY":
      return createHistoryBackground(width, height);
    case "DOCUMENTARY":
      return createDocumentaryBackground(width, height);
    case "KIDS":
      return createCartoonBackground(width, height, "meadow");
    default:
      return createFinanceBackground(width, height);
  }
}
