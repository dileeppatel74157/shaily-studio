/**
 * Asset Validator
 * Validates file existence, format integrity, non-zero dimensions, checksum availability,
 * path traversal security, alpha transparency requirements, and production validity.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { IntelligentAsset, AssetRequirement } from "./models";

export interface AssetValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class AssetValidator {
  /**
   * Validates path safety against directory traversal attacks.
   */
  public static validatePathSecurity(targetPath: string, allowedRoot?: string): boolean {
    if (!targetPath) return false;
    const normalized = path.normalize(targetPath);
    if (normalized.includes("..\\..") || normalized.includes("../..")) {
      return false;
    }
    if (allowedRoot) {
      const normalizedRoot = path.normalize(allowedRoot);
      const relative = path.relative(normalizedRoot, normalized);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Validates a resolved IntelligentAsset against requirements and system rules.
   */
  public static validateAsset(
    asset: IntelligentAsset,
    requirement?: AssetRequirement,
    isProduction = false,
    allowedStorageRoot?: string
  ): AssetValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Basic Identity Check
    if (!asset.id) {
      errors.push("ASSET_VALIDATION_FAILED: Asset has empty or missing id.");
    }
    if (!asset.filePath && !asset.publicUrl) {
      errors.push("ASSET_NOT_FOUND: Asset has neither filePath nor publicUrl.");
    }

    // 2. Production Mock URL Check
    if (isProduction) {
      const url = asset.publicUrl || asset.filePath || "";
      if (
        url.includes("mockmedia.ai") ||
        url.includes("mock.ai") ||
        url.includes("stub-img") ||
        url.includes("stub-voice")
      ) {
        errors.push(`ASSET_PROVIDER_UNAVAILABLE: Production asset is a mock/stub reference: ${url}`);
      }
    }

    // 3. File System & Security Validation
    if (asset.filePath) {
      if (!this.validatePathSecurity(asset.filePath, allowedStorageRoot)) {
        errors.push(`ASSET_VALIDATION_FAILED: Path traversal detected in asset filePath: ${asset.filePath}`);
      } else if (!fs.existsSync(asset.filePath)) {
        errors.push(`ASSET_NOT_FOUND: Asset file does not exist on disk: ${asset.filePath}`);
      } else {
        const stat = fs.statSync(asset.filePath);
        if (stat.size === 0) {
          errors.push(`ASSET_VALIDATION_FAILED: Asset file is 0 bytes (empty): ${asset.filePath}`);
        }
      }
    }

    // 4. Dimension & Format Validation
    if (asset.width !== undefined && asset.width <= 0) {
      errors.push(`ASSET_VALIDATION_FAILED: Asset width must be greater than 0: ${asset.width}`);
    }
    if (asset.height !== undefined && asset.height <= 0) {
      errors.push(`ASSET_VALIDATION_FAILED: Asset height must be greater than 0: ${asset.height}`);
    }

    // 5. Alpha Transparency Check
    if (requirement?.requiresAlpha) {
      if (asset.hasAlphaChannel === false) {
        warnings.push(`Alpha channel required for ${requirement.semanticRole}, but asset has no alpha.`);
      }
    }

    // 6. Checksum Verification
    if (!asset.checksum || asset.checksum.length < 16) {
      warnings.push("Asset does not have a verified SHA-256 checksum.");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
