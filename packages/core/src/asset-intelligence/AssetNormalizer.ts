/**
 * Asset Normalizer
 * Inspects image binary headers (PNG, JPEG, WebP, SVG), parses dimensions,
 * verifies alpha transparency, detects MIME types, and computes SHA-256 checksums.
 *
 * Fully deterministic, zero native library dependencies.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";

export interface NormalizedAssetMetadata {
  mimeType: string;
  format: string;
  width: number;
  height: number;
  aspectRatio: string;
  sizeBytes: number;
  checksum: string;
  hasAlphaChannel: boolean;
}

export class AssetNormalizer {
  /**
   * Computes SHA-256 checksum for a buffer or string.
   */
  public static computeChecksum(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Computes a deterministic content hash from asset generation parameters.
   */
  public static computeContentHash(params: {
    kind: string;
    prompt: string;
    style?: string;
    width?: number;
    height?: number;
    provider?: string;
    seed?: number;
  }): string {
    const raw = JSON.stringify({
      k: params.kind,
      p: params.prompt.trim().toLowerCase(),
      s: (params.style || "").trim().toLowerCase(),
      w: params.width || 1920,
      h: params.height || 1080,
      pr: params.provider || "default",
      sd: params.seed || 0
    });
    return crypto.createHash("sha256").update(raw).digest("hex");
  }

  /**
   * Inspects binary buffer and extracts dimensions, MIME type, checksum, and alpha channel status.
   */
  public static inspectImageBuffer(buffer: Buffer): NormalizedAssetMetadata {
    const checksum = this.computeChecksum(buffer);
    const sizeBytes = buffer.length;

    // 1. Detect PNG (Header: 89 50 4E 47 0D 0A 1A 0A)
    if (
      buffer.length >= 24 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      const colorType = buffer[25];
      // Color type 4 = Greyscale with alpha, 6 = RGBA
      const hasAlphaChannel = colorType === 4 || colorType === 6;

      return {
        mimeType: "image/png",
        format: "PNG",
        width: Math.max(1, width),
        height: Math.max(1, height),
        aspectRatio: this.calculateAspectRatio(width, height),
        sizeBytes,
        checksum,
        hasAlphaChannel
      };
    }

    // 2. Detect JPEG (Header: FF D8 FF)
    if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      const dims = this.parseJpegDimensions(buffer);
      return {
        mimeType: "image/jpeg",
        format: "JPEG",
        width: dims.width,
        height: dims.height,
        aspectRatio: this.calculateAspectRatio(dims.width, dims.height),
        sizeBytes,
        checksum,
        hasAlphaChannel: false
      };
    }

    // 3. Detect WebP (Header: RIFF .... WEBP)
    if (
      buffer.length >= 16 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    ) {
      const dims = this.parseWebpDimensions(buffer);
      return {
        mimeType: "image/webp",
        format: "WEBP",
        width: dims.width,
        height: dims.height,
        aspectRatio: this.calculateAspectRatio(dims.width, dims.height),
        sizeBytes,
        checksum,
        hasAlphaChannel: dims.hasAlpha
      };
    }

    // 4. Detect SVG text
    const textSample = buffer.toString("utf8", 0, Math.min(buffer.length, 512));
    if (textSample.includes("<svg") || textSample.includes("xmlns=\"http://www.w3.org/2000/svg\"")) {
      const widthMatch = textSample.match(/width=["'](\d+)["']/);
      const heightMatch = textSample.match(/height=["'](\d+)["']/);
      const width = widthMatch ? parseInt(widthMatch[1], 10) : 1920;
      const height = heightMatch ? parseInt(heightMatch[1], 10) : 1080;

      return {
        mimeType: "image/svg+xml",
        format: "SVG",
        width,
        height,
        aspectRatio: this.calculateAspectRatio(width, height),
        sizeBytes,
        checksum,
        hasAlphaChannel: true
      };
    }

    // Fallback for general binary / unknown image
    return {
      mimeType: "application/octet-stream",
      format: "BINARY",
      width: 1280,
      height: 720,
      aspectRatio: "16:9",
      sizeBytes,
      checksum,
      hasAlphaChannel: false
    };
  }

  /**
   * Helper to parse JPEG frame header for width & height
   */
  private static parseJpegDimensions(buffer: Buffer): { width: number; height: number } {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      // SOF0 to SOF3, SOF5 to SOF7, SOF9 to SOF11, SOF13 to SOF15 markers contain dimensions
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width: Math.max(1, width), height: Math.max(1, height) };
      }
      const length = buffer.readUInt16BE(offset + 2);
      offset += 2 + length;
    }
    return { width: 1280, height: 720 };
  }

  /**
   * Helper to parse WebP dimensions
   */
  private static parseWebpDimensions(buffer: Buffer): { width: number; height: number; hasAlpha: boolean } {
    try {
      const type = buffer.toString("ascii", 12, 16);
      if (type === "VP8X" && buffer.length >= 30) {
        const width = 1 + buffer.readUIntLE(24, 3);
        const height = 1 + buffer.readUIntLE(27, 3);
        const flags = buffer[20];
        const hasAlpha = (flags & 0x10) !== 0;
        return { width, height, hasAlpha };
      } else if (type === "VP8 " && buffer.length >= 30) {
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        return { width, height, hasAlpha: false };
      } else if (type === "VP8L" && buffer.length >= 25) {
        const b1 = buffer[21];
        const b2 = buffer[22];
        const b3 = buffer[23];
        const b4 = buffer[24];
        const width = 1 + (((b2 & 0x3f) << 8) | b1);
        const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
        return { width, height, hasAlpha: true };
      }
    } catch (_) {}
    return { width: 1280, height: 720, hasAlpha: false };
  }

  /**
   * Calculates standardized aspect ratio string
   */
  public static calculateAspectRatio(width: number, height: number): string {
    if (!width || !height) return "16:9";
    const ratio = width / height;
    if (Math.abs(ratio - 16 / 9) < 0.05) return "16:9";
    if (Math.abs(ratio - 1.0) < 0.05) return "1:1";
    if (Math.abs(ratio - 9 / 16) < 0.05) return "9:16";
    if (Math.abs(ratio - 4 / 3) < 0.05) return "4:3";
    if (Math.abs(ratio - 21 / 9) < 0.05) return "21:9";
    return `${width}:${height}`;
  }
}
