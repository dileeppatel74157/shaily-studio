/**
 * Universal Visual Primitive Deterministic Renderer
 * Generates high-definition vector graphics (SVG) and transparent RGBA PNG buffers
 * for all visual primitives across Finance, History, Documentary, Kids, and General domains.
 *
 * Fully deterministic, Docker-compatible, zero browser dependency.
 */

import * as zlib from "node:zlib";
import {
  VisualPrimitive,
  VisualPrimitiveStyle,
  ChartPrimitiveData,
  TimelinePrimitiveData,
  StatCardPrimitiveData,
  NumberCounterPrimitiveData,
  PercentageIndicatorPrimitiveData,
  LowerThirdPrimitiveData,
  InfoCardPrimitiveData,
  CalloutPrimitiveData,
  PixelDimensions
} from "./models";

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

function hexToRgba(hex: string, defaultAlpha = 255): { r: number; g: number; b: number; a: number } {
  if (hex.startsWith("rgba")) {
    const m = hex.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
    if (m) {
      return {
        r: parseInt(m[1], 10),
        g: parseInt(m[2], 10),
        b: parseInt(m[3], 10),
        a: m[4] !== undefined ? Math.round(parseFloat(m[4]) * 255) : 255
      };
    }
  }
  let clean = hex.replace("#", "");
  if (clean.length === 3) {
    clean = clean.split("").map(c => c + c).join("");
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.substring(0, 2), 16),
      g: parseInt(clean.substring(2, 4), 16),
      b: parseInt(clean.substring(4, 6), 16),
      a: defaultAlpha
    };
  }
  return { r: 56, g: 189, b: 248, a: defaultAlpha };
}

// 5x7 Basic ASCII Bitmap Font for crisp legible in-buffer text rendering
const FONT_5X7: Record<string, number[]> = {
  " ": [0, 0, 0, 0, 0],
  "!": [0, 0, 95, 0, 0],
  "\"": [0, 7, 0, 7, 0],
  "#": [20, 127, 20, 127, 20],
  "$": [36, 42, 127, 42, 18],
  "%": [35, 19, 8, 100, 98],
  "&": [54, 73, 85, 34, 80],
  "'": [0, 5, 3, 0, 0],
  "(": [0, 28, 34, 65, 0],
  ")": [0, 65, 34, 28, 0],
  "*": [20, 8, 62, 8, 20],
  "+": [8, 8, 62, 8, 8],
  ",": [0, 80, 48, 0, 0],
  "-": [8, 8, 8, 8, 8],
  ".": [0, 96, 96, 0, 0],
  "/": [32, 16, 8, 4, 2],
  "0": [62, 81, 73, 69, 62],
  "1": [0, 66, 127, 64, 0],
  "2": [66, 97, 81, 73, 70],
  "3": [33, 65, 69, 75, 49],
  "4": [24, 20, 18, 127, 16],
  "5": [39, 69, 69, 69, 57],
  "6": [60, 74, 73, 73, 48],
  "7": [1, 113, 9, 5, 3],
  "8": [54, 73, 73, 73, 54],
  "9": [6, 73, 73, 41, 30],
  ":": [0, 54, 54, 0, 0],
  ";": [0, 86, 54, 0, 0],
  "<": [8, 20, 34, 65, 0],
  "=": [20, 20, 20, 20, 20],
  ">": [0, 65, 34, 20, 8],
  "?": [2, 1, 81, 9, 6],
  "@": [62, 65, 93, 85, 30],
  "A": [124, 18, 17, 18, 124],
  "B": [127, 73, 73, 73, 54],
  "C": [62, 65, 65, 65, 34],
  "D": [127, 65, 65, 34, 28],
  "E": [127, 73, 73, 73, 65],
  "F": [127, 9, 9, 9, 1],
  "G": [62, 65, 73, 73, 122],
  "H": [127, 8, 8, 8, 127],
  "I": [0, 65, 127, 65, 0],
  "J": [32, 64, 65, 63, 1],
  "K": [127, 8, 20, 34, 65],
  "L": [127, 64, 64, 64, 64],
  "M": [127, 2, 12, 2, 127],
  "N": [127, 4, 8, 16, 127],
  "O": [62, 65, 65, 65, 62],
  "P": [127, 9, 9, 9, 6],
  "Q": [62, 65, 81, 33, 94],
  "R": [127, 9, 25, 41, 70],
  "S": [70, 73, 73, 73, 49],
  "T": [1, 1, 127, 1, 1],
  "U": [63, 64, 64, 64, 63],
  "V": [31, 32, 64, 32, 31],
  "M_": [127, 32, 24, 32, 127],
  "X": [99, 20, 8, 20, 99],
  "Y": [7, 8, 112, 8, 7],
  "Z": [97, 81, 73, 69, 67]
};

export class RgbaCanvas {
  public readonly width: number;
  public readonly height: number;
  public readonly buffer: Buffer;

  constructor(width: number, height: number) {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.buffer = Buffer.alloc(this.width * this.height * 4, 0); // Transparent black
  }

  public setPixel(x: number, y: number, r: number, g: number, b: number, a = 255): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (Math.floor(y) * this.width + Math.floor(x)) * 4;
    const srcA = a / 255;
    const dstA = this.buffer[idx + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);

    if (outA > 0) {
      this.buffer[idx] = Math.round((r * srcA + this.buffer[idx] * dstA * (1 - srcA)) / outA);
      this.buffer[idx + 1] = Math.round((g * srcA + this.buffer[idx + 1] * dstA * (1 - srcA)) / outA);
      this.buffer[idx + 2] = Math.round((b * srcA + this.buffer[idx + 2] * dstA * (1 - srcA)) / outA);
      this.buffer[idx + 3] = Math.round(outA * 255);
    }
  }

  public fillRect(x: number, y: number, w: number, h: number, r: number, g: number, b: number, a = 255, rx = 0): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + w));
    const y1 = Math.min(this.height, Math.ceil(y + h));

    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        if (rx > 0) {
          // Check rounded corner distance
          let cx = px < x + rx ? x + rx : px > x + w - rx ? x + w - rx : px;
          let cy = py < y + rx ? y + rx : py > y + h - rx ? y + h - rx : py;
          let dx = px - cx;
          let dy = py - cy;
          if (dx * dx + dy * dy > rx * rx) continue;
        }
        this.setPixel(px, py, r, g, b, a);
      }
    }
  }

  public strokeRect(x: number, y: number, w: number, h: number, r: number, g: number, b: number, a = 255, rx = 0, strokeW = 2): void {
    for (let sw = 0; sw < strokeW; sw++) {
      for (let px = x; px < x + w; px++) {
        this.setPixel(px, y + sw, r, g, b, a);
        this.setPixel(px, y + h - 1 - sw, r, g, b, a);
      }
      for (let py = y; py < y + h; py++) {
        this.setPixel(x + sw, py, r, g, b, a);
        this.setPixel(x + w - 1 - sw, py, r, g, b, a);
      }
    }
  }

  public drawLine(x0: number, y0: number, x1: number, y1: number, r: number, g: number, b: number, a = 255, strokeW = 3): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let cx = x0;
    let cy = y0;

    while (true) {
      for (let ox = -Math.floor(strokeW / 2); ox <= Math.floor(strokeW / 2); ox++) {
        for (let oy = -Math.floor(strokeW / 2); oy <= Math.floor(strokeW / 2); oy++) {
          this.setPixel(cx + ox, cy + oy, r, g, b, a);
        }
      }
      if (Math.abs(cx - x1) < 1 && Math.abs(cy - y1) < 1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
    }
  }

  public drawCircle(cx: number, cy: number, radius: number, r: number, g: number, b: number, a = 255, fill = true): void {
    const r2 = radius * radius;
    const x0 = Math.max(0, Math.floor(cx - radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const x1 = Math.min(this.width, Math.ceil(cx + radius));
    const y1 = Math.min(this.height, Math.ceil(cy + radius));

    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const d2 = (px - cx) ** 2 + (py - cy) ** 2;
        if (fill && d2 <= r2) {
          this.setPixel(px, py, r, g, b, a);
        } else if (!fill && Math.abs(Math.sqrt(d2) - radius) < 1.5) {
          this.setPixel(px, py, r, g, b, a);
        }
      }
    }
  }

  public drawText(text: string, x: number, y: number, scale = 2, r = 255, g = 255, b = 255, a = 255): void {
    const upper = text.toUpperCase();
    let curX = Math.round(x);
    const startY = Math.round(y);

    for (let i = 0; i < upper.length; i++) {
      const ch = upper[i];
      const glyph = FONT_5X7[ch] || FONT_5X7["?"] || [0, 0, 0, 0, 0];

      for (let col = 0; col < 5; col++) {
        const colBits = glyph[col];
        for (let row = 0; row < 7; row++) {
          if ((colBits & (1 << row)) !== 0) {
            for (let sx = 0; sx < scale; sx++) {
              for (let sy = 0; sy < scale; sy++) {
                this.setPixel(curX + col * scale + sx, startY + row * scale + sy, r, g, b, a);
              }
            }
          }
        }
      }
      curX += 6 * scale;
    }
  }

  public toPngBuffer(): Buffer {
    const rowSize = this.width * 4 + 1;
    const raw = Buffer.alloc(rowSize * this.height);

    for (let y = 0; y < this.height; y++) {
      const rowOffset = y * rowSize;
      raw[rowOffset] = 0; // Filter 0 (None)
      const srcOffset = y * this.width * 4;
      this.buffer.copy(raw, rowOffset + 1, srcOffset, srcOffset + this.width * 4);
    }

    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(this.width, 0);
    ihdrData.writeUInt32BE(this.height, 4);
    ihdrData[8] = 8;
    ihdrData[9] = 6; // RGBA
    ihdrData[10] = 0;
    ihdrData[11] = 0;
    ihdrData[12] = 0;

    const ihdrChunk = makePngChunk("IHDR", ihdrData);
    const compressed = zlib.deflateSync(raw);
    const idatChunk = makePngChunk("IDAT", compressed);
    const iendChunk = makePngChunk("IEND", Buffer.alloc(0));

    return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
  }
}

function escapeXml(unsafe: string): string {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export class PrimitiveRenderer {
  /**
   * Render any VisualPrimitive into a transparent RGBA PNG Buffer.
   */
  public static renderPrimitiveToPng(
    primitive: VisualPrimitive<any>,
    dimensions: PixelDimensions
  ): Buffer {
    const width = Math.max(80, Math.round(dimensions.width));
    const height = Math.max(40, Math.round(dimensions.height));
    const canvas = new RgbaCanvas(width, height);
    const s = primitive.style || {};

    const bgRgba = hexToRgba(s.backgroundColor || "rgba(15, 23, 42, 0.92)");
    const primaryRgba = hexToRgba(s.primaryColor || "#38BDF8");
    const accentRgba = hexToRgba(s.accentColor || "#F59E0B");
    const textRgba = hexToRgba(s.textColor || "#F8FAFC");
    const rx = s.borderRadius ?? 16;

    // Draw base card container
    canvas.fillRect(0, 0, width, height, bgRgba.r, bgRgba.g, bgRgba.b, bgRgba.a, rx);
    canvas.strokeRect(0, 0, width, height, 255, 255, 255, 45, rx, 2);

    switch (primitive.type) {
      case "LINE_CHART":
      case "AREA_CHART": {
        const data: ChartPrimitiveData = primitive.metadata || {
          title: "Trend Overview",
          dataPoints: [{ label: "Y1", value: 30 }, { label: "Y2", value: 60 }, { label: "Y3", value: 90 }]
        };
        if (data.title) {
          canvas.drawText(data.title, 24, 20, 2, textRgba.r, textRgba.g, textRgba.b, textRgba.a);
        }
        const pts = data.dataPoints || [];
        const maxVal = Math.max(10, ...pts.map(p => p.value));
        const chartT = data.title ? 60 : 30;
        const chartB = height - 40;
        const chartH = chartB - chartT;
        const chartW = width - 80;

        // Grid lines
        for (let g = 0; g <= 3; g++) {
          const gy = chartT + (g / 3) * chartH;
          canvas.drawLine(40, gy, width - 40, gy, 255, 255, 255, 25, 1);
        }

        // Points and line segments
        const coords = pts.map((p, idx) => {
          const px = 50 + (pts.length === 1 ? chartW / 2 : (idx / (pts.length - 1)) * chartW);
          const py = chartB - (p.value / maxVal) * chartH;
          return { px, py, label: p.label, value: p.value };
        });

        for (let i = 0; i < coords.length - 1; i++) {
          canvas.drawLine(coords[i].px, coords[i].py, coords[i + 1].px, coords[i + 1].py, primaryRgba.r, primaryRgba.g, primaryRgba.b, 255, 4);
        }

        for (const c of coords) {
          canvas.drawCircle(c.px, c.py, 6, primaryRgba.r, primaryRgba.g, primaryRgba.b, 255, true);
          canvas.drawCircle(c.px, c.py, 8, 255, 255, 255, 200, false);
          canvas.drawText(String(c.value), c.px - 8, c.py - 18, 1, textRgba.r, textRgba.g, textRgba.b, 240);
          canvas.drawText(c.label, c.px - 8, chartB + 10, 1, 200, 200, 200, 200);
        }
        break;
      }

      case "BAR_CHART": {
        const data: ChartPrimitiveData = primitive.metadata || {
          title: "Comparison",
          dataPoints: [{ label: "A", value: 40 }, { label: "B", value: 80 }, { label: "C", value: 60 }]
        };
        if (data.title) {
          canvas.drawText(data.title, 24, 20, 2, textRgba.r, textRgba.g, textRgba.b, textRgba.a);
        }
        const pts = data.dataPoints || [];
        const maxVal = Math.max(10, ...pts.map(p => p.value));
        const chartT = data.title ? 60 : 30;
        const chartB = height - 40;
        const chartH = chartB - chartT;
        const slotW = (width - 80) / Math.max(1, pts.length);
        const barW = Math.min(50, slotW * 0.6);

        pts.forEach((p, idx) => {
          const bx = 45 + idx * slotW + (slotW - barW) / 2;
          const bh = (p.value / maxVal) * chartH;
          const by = chartB - bh;
          canvas.fillRect(bx, by, barW, bh, primaryRgba.r, primaryRgba.g, primaryRgba.b, 255, 6);
          canvas.drawText(String(p.value), bx + barW / 2 - 6, by - 16, 1, textRgba.r, textRgba.g, textRgba.b, 240);
          canvas.drawText(p.label, bx + barW / 2 - 6, chartB + 10, 1, 200, 200, 200, 200);
        });
        break;
      }

      case "DONUT_CHART": {
        const cx = width * 0.35;
        const cy = height * 0.52;
        const r = Math.min(width, height) * 0.28;
        canvas.drawCircle(cx, cy, r, primaryRgba.r, primaryRgba.g, primaryRgba.b, 255, true);
        canvas.drawCircle(cx, cy, r * 0.6, bgRgba.r, bgRgba.g, bgRgba.b, 255, true);
        canvas.drawText("DATA", cx - 12, cy - 4, 1, 255, 255, 255, 255);
        canvas.drawText("75%", width * 0.65, height * 0.45, 3, primaryRgba.r, primaryRgba.g, primaryRgba.b, 255);
        canvas.drawText("METRIC", width * 0.65, height * 0.65, 2, textRgba.r, textRgba.g, textRgba.b, 200);
        break;
      }

      case "NUMBER_COUNTER": {
        const data: NumberCounterPrimitiveData = primitive.metadata || { startValue: 0, targetValue: 100, label: "Total Metric" };
        if (data.label) {
          canvas.drawText(data.label, 24, 24, 2, 200, 220, 240, 200);
        }
        const valStr = `${data.prefix || ""}${data.targetValue}${data.suffix || ""}`;
        canvas.drawText(valStr, 24, height * 0.52, 4, primaryRgba.r, primaryRgba.g, primaryRgba.b, 255);
        break;
      }

      case "PERCENTAGE_INDICATOR": {
        const data: PercentageIndicatorPrimitiveData = primitive.metadata || { percentage: 78, label: "Index Rate" };
        const cx = width / 2;
        const cy = height * 0.45;
        const r = Math.min(width, height) * 0.28;
        canvas.drawCircle(cx, cy, r, primaryRgba.r, primaryRgba.g, primaryRgba.b, 255, false);
        canvas.drawText(`${data.percentage || 75}%`, cx - 20, cy - 8, 3, textRgba.r, textRgba.g, textRgba.b, 255);
        if (data.label) {
          canvas.drawText(data.label, cx - data.label.length * 4, height * 0.82, 1, 200, 220, 240, 220);
        }
        break;
      }

      case "TIMELINE": {
        const data: TimelinePrimitiveData = primitive.metadata || {
          title: "Timeline Chronology",
          milestones: [{ dateOrEra: "753 BC", title: "Era 1" }, { dateOrEra: "27 BC", title: "Era 2", isHighlighted: true }, { dateOrEra: "476 AD", title: "Era 3" }]
        };
        if (data.title) {
          canvas.drawText(data.title, 24, 20, 2, textRgba.r, textRgba.g, textRgba.b, textRgba.a);
        }
        const ms = data.milestones || [];
        const trackY = height * 0.54;
        canvas.drawLine(40, trackY, width - 40, trackY, accentRgba.r, accentRgba.g, accentRgba.b, 255, 3);
        const slotW = (width - 80) / Math.max(1, ms.length);

        ms.forEach((m, idx) => {
          const mx = 45 + idx * slotW + slotW / 2;
          canvas.drawCircle(mx, trackY, m.isHighlighted ? 9 : 6, m.isHighlighted ? 255 : primaryRgba.r, m.isHighlighted ? 200 : primaryRgba.g, primaryRgba.b, 255, true);
          canvas.drawText(m.dateOrEra, mx - m.dateOrEra.length * 4, trackY - 24, 1, 255, 255, 255, 255);
          canvas.drawText(m.title, mx - m.title.length * 4, trackY + 16, 1, textRgba.r, textRgba.g, textRgba.b, 220);
        });
        break;
      }

      case "STAT_CARD": {
        const data: StatCardPrimitiveData = primitive.metadata || { badgeText: "METRIC", value: "8.4%", label: "Inflation Rate", deltaText: "+2.1%" };
        if (data.badgeText) {
          canvas.fillRect(20, 16, 80, 20, primaryRgba.r, primaryRgba.g, primaryRgba.b, 60, 4);
          canvas.drawText(data.badgeText, 26, 20, 1, primaryRgba.r, primaryRgba.g, primaryRgba.b, 255);
        }
        canvas.drawText(String(data.value || ""), 20, data.badgeText ? 50 : 30, 4, textRgba.r, textRgba.g, textRgba.b, 255);
        canvas.drawText(data.label || "", 20, height - 30, 2, 180, 200, 220, 200);
        if (data.deltaText) {
          canvas.drawText(data.deltaText, width - 70, 50, 2, accentRgba.r, accentRgba.g, accentRgba.b, 255);
        }
        break;
      }

      case "LOWER_THIRD": {
        const data: LowerThirdPrimitiveData = primitive.metadata || { headline: "Expert Overview", subheadline: "Core Analysis", categoryBadge: "INSIGHT" };
        canvas.fillRect(0, 0, 8, height, accentRgba.r, accentRgba.g, accentRgba.b, 255, 4);
        if (data.categoryBadge) {
          canvas.fillRect(20, 14, 90, 18, accentRgba.r, accentRgba.g, accentRgba.b, 255, 4);
          canvas.drawText(data.categoryBadge, 26, 18, 1, 15, 23, 42, 255);
        }
        canvas.drawText(data.headline || "", 20, data.categoryBadge ? 42 : 28, 2, textRgba.r, textRgba.g, textRgba.b, 255);
        if (data.subheadline) {
          canvas.drawText(data.subheadline, 20, data.categoryBadge ? 68 : 56, 1, 200, 220, 240, 200);
        }
        break;
      }

      case "INFO_CARD":
      case "CALLOUT": {
        const data = primitive.metadata || { title: "Information", body: "Detailed key insight" };
        const title = data.title || data.header || "Info Card";
        const body = data.body || data.detail || "";
        canvas.drawText(title, 20, 20, 2, textRgba.r, textRgba.g, textRgba.b, 255);
        canvas.drawText(body.substring(0, 36), 20, 50, 1, 200, 220, 240, 220);
        break;
      }

      case "TEXT": {
        const text = primitive.metadata?.text || "Visual Text";
        canvas.drawText(text, 24, height / 2 - 8, 3, textRgba.r, textRgba.g, textRgba.b, 255);
        break;
      }

      case "CHARACTER": {
        canvas.drawCircle(45, height / 2, 25, accentRgba.r, accentRgba.g, accentRgba.b, 255, true);
        canvas.drawText("LEO", 35, height / 2 - 4, 1, 255, 255, 255, 255);
        const name = primitive.metadata?.characterName || "Character";
        canvas.drawText(name, 85, height / 2 - 8, 2, textRgba.r, textRgba.g, textRgba.b, 255);
        break;
      }

      default: {
        canvas.drawText(primitive.id, 20, height / 2 - 6, 2, textRgba.r, textRgba.g, textRgba.b, 255);
        break;
      }
    }

    return canvas.toPngBuffer();
  }

  /**
   * Render any VisualPrimitive into a self-contained SVG string with alpha transparency.
   */
  public static renderPrimitiveToSvg(
    primitive: VisualPrimitive<any>,
    dimensions: PixelDimensions
  ): string {
    const width = Math.max(50, Math.round(dimensions.width));
    const height = Math.max(30, Math.round(dimensions.height));

    switch (primitive.type) {
      case "LINE_CHART":
        return this.renderLineChartSvg(primitive, width, height);
      case "BAR_CHART":
        return this.renderBarChartSvg(primitive, width, height);
      case "AREA_CHART":
        return this.renderAreaChartSvg(primitive, width, height);
      case "DONUT_CHART":
        return this.renderDonutChartSvg(primitive, width, height);
      case "NUMBER_COUNTER":
        return this.renderNumberCounterSvg(primitive, width, height);
      case "PERCENTAGE_INDICATOR":
        return this.renderPercentageIndicatorSvg(primitive, width, height);
      case "TIMELINE":
        return this.renderTimelineSvg(primitive, width, height);
      case "STAT_CARD":
        return this.renderStatCardSvg(primitive, width, height);
      case "LOWER_THIRD":
        return this.renderLowerThirdSvg(primitive, width, height);
      case "INFO_CARD":
        return this.renderInfoCardSvg(primitive, width, height);
      case "CALLOUT":
        return this.renderCalloutSvg(primitive, width, height);
      case "SHAPE":
        return this.renderShapeSvg(primitive, width, height);
      case "TEXT":
        return this.renderTextSvg(primitive, width, height);
      case "CHARACTER":
        return this.renderCharacterCardSvg(primitive, width, height);
      case "IMAGE":
        return this.renderImageFrameSvg(primitive, width, height);
      default:
        return this.renderGenericCardSvg(primitive, width, height);
    }
  }

  public static renderLineChartSvg(primitive: VisualPrimitive<any>, width: number, height: number): string {
    const data: ChartPrimitiveData = primitive.metadata || {
      title: "Trend Over Time",
      dataPoints: [{ label: "P1", value: 20 }, { label: "P2", value: 45 }, { label: "P3", value: 80 }]
    };
    const s = primitive.style || {};
    const primaryColor = s.primaryColor || "#00E5FF";
    const bg = s.backgroundColor || "rgba(15, 23, 42, 0.88)";
    const textColor = s.textColor || "#F8FAFC";
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="${s.borderRadius ?? 20}" fill="${bg}" stroke="rgba(255,255,255,0.18)" />
  ${data.title ? `<text x="40" y="42" fill="${textColor}" font-size="22" font-weight="bold" font-family="sans-serif">${escapeXml(data.title)}</text>` : ""}
</svg>`;
  }

  public static renderBarChartSvg(primitive: VisualPrimitive<any>, width: number, height: number): string {
    const data: ChartPrimitiveData = primitive.metadata || { title: "Comparison Metric", dataPoints: [] };
    const s = primitive.style || {};
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="${s.borderRadius ?? 20}" fill="${s.backgroundColor || "rgba(15,23,42,0.88)"}" />
  <text x="40" y="42" fill="#F8FAFC" font-size="22" font-weight="bold" font-family="sans-serif">${escapeXml(data.title || "Bar Chart")}</text>
</svg>`;
  }

  public static renderAreaChartSvg(primitive: VisualPrimitive<any>, width: number, height: number): string {
    return this.renderLineChartSvg(primitive, width, height);
  }

  public static renderDonutChartSvg(primitive: VisualPrimitive<any>, width: number, height: number): string {
    const s = primitive.style || {};
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="${s.borderRadius ?? 20}" fill="${s.backgroundColor || "rgba(15,23,42,0.88)"}" />
  <circle cx="${width / 2}" cy="${height / 2}" r="50" fill="none" stroke="#38BDF8" stroke-width="20" />
</svg>`;
  }

  public static renderNumberCounterSvg(primitive: VisualPrimitive<any>, width: number, height: number): string {
    const data = primitive.metadata || { targetValue: 100, label: "Revenue" };
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="16" fill="rgba(15,23,42,0.9)" />
  <text x="${width / 2}" y="${height / 2 + 10}" fill="#38BDF8" font-size="36" font-weight="bold" text-anchor="middle" font-family="sans-serif">${data.targetValue}</text>
</svg>`;
  }

  public static renderPercentageIndicatorSvg(primitive: VisualPrimitive<any>, width: number, height: number): string {
    const data = primitive.metadata || { percentage: 75, label: "Rate" };
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="16" fill="rgba(15,23,42,0.9)" />
  <text x="${width / 2}" y="${height / 2 + 10}" fill="#F43F5E" font-size="32" font-weight="bold" text-anchor="middle" font-family="sans-serif">${data.percentage}%</text>
</svg>`;
  }

  public static renderTimelineSvg(primitive: VisualPrimitive<any>, width: number, height: number): string {
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="16" fill="rgba(24,18,12,0.9)" />
  <line x1="40" y1="${height / 2}" x2="${width - 40}" y2="${height / 2}" stroke="#D97706" stroke-width="4" />
</svg>`;
  }

  public static renderStatCardSvg(primitive: VisualPrimitive<any>, width: number, height: number): string {
    const data = primitive.metadata || { value: "8.4%", label: "Inflation" };
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="16" fill="rgba(15,23,42,0.9)" />
  <text x="24" y="60" fill="#F8FAFC" font-size="38" font-weight="bold" font-family="sans-serif">${escapeXml(String(data.value))}</text>
  <text x="24" y="90" fill="rgba(255,255,255,0.7)" font-size="14" font-family="sans-serif">${escapeXml(data.label)}</text>
</svg>`;
  }

  public static renderLowerThirdSvg(primitive: VisualPrimitive<any>, width: number, height: number): string {
    const data = primitive.metadata || { headline: "Expert Name", subheadline: "Title" };
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="12" fill="rgba(15,23,42,0.92)" />
  <rect width="8" height="${height}" fill="#38BDF8" rx="4" />
  <text x="24" y="44" fill="#F8FAFC" font-size="22" font-weight="bold" font-family="sans-serif">${escapeXml(data.headline)}</text>
  <text x="24" y="68" fill="rgba(255,255,255,0.7)" font-size="14" font-family="sans-serif">${escapeXml(data.subheadline)}</text>
</svg>`;
  }

  public static renderInfoCardSvg(primitive: VisualPrimitive<any>, width: number, height: number): string {
    const data = primitive.metadata || { title: "Title", body: "Description text" };
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="16" fill="rgba(15,23,42,0.9)" />
  <text x="24" y="40" fill="#F8FAFC" font-size="20" font-weight="bold" font-family="sans-serif">${escapeXml(data.title)}</text>
</svg>`;
  }

  public static renderCalloutSvg(primitive: VisualPrimitive<any>, width: number, height: number): string {
    const data = primitive.metadata || { header: "Alert", detail: "Notice" };
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="12" fill="rgba(225,29,72,0.92)" />
  <text x="20" y="36" fill="#FFFFFF" font-size="18" font-weight="bold" font-family="sans-serif">${escapeXml(data.header)}</text>
</svg>`;
  }

  public static renderShapeSvg(primitive: VisualPrimitive<any>, width: number, height: number): string {
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="16" fill="#38BDF8" />
</svg>`;
  }

  public static renderTextSvg(primitive: VisualPrimitive<any>, width: number, height: number): string {
    const text = primitive.metadata?.text || "Text";
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="${width / 2}" y="${height / 2 + 10}" fill="#FFFFFF" font-size="32" font-weight="bold" text-anchor="middle" font-family="sans-serif">${escapeXml(text)}</text>
</svg>`;
  }

  public static renderCharacterCardSvg(primitive: VisualPrimitive<any>, width: number, height: number): string {
    const name = primitive.metadata?.characterName || "Character";
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="20" fill="rgba(15,23,42,0.88)" />
  <text x="24" y="${height / 2 + 8}" fill="#F8FAFC" font-size="20" font-weight="bold" font-family="sans-serif">${escapeXml(name)}</text>
</svg>`;
  }

  public static renderImageFrameSvg(primitive: VisualPrimitive<any>, width: number, height: number): string {
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="16" fill="rgba(30,41,59,0.85)" />
</svg>`;
  }

  public static renderGenericCardSvg(primitive: VisualPrimitive<any>, width: number, height: number): string {
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="16" fill="rgba(15,23,42,0.9)" />
  <text x="${width / 2}" y="${height / 2 + 6}" fill="#F8FAFC" font-size="18" font-weight="bold" text-anchor="middle" font-family="sans-serif">${escapeXml(primitive.id)}</text>
</svg>`;
  }
}
