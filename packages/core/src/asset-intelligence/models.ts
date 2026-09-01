/**
 * Universal Asset Intelligence Domain Models
 * Domain-agnostic asset management for Shaily Studio Video OS.
 * Serves FINANCE, HISTORY, DOCUMENTARY, KIDS, GENERAL and future domains.
 */

export type AssetKind =
  | "IMAGE"
  | "CHARACTER"
  | "BACKGROUND"
  | "FOREGROUND"
  | "ARCHIVAL"
  | "DIAGRAM"
  | "MAP"
  | "ICON"
  | "PHOTO"
  | "ILLUSTRATION"
  | "TEXTURE"
  | "VIDEO"
  | "AUDIO"
  | "MUSIC"
  | "SFX"
  | "FONT"
  | "OTHER";

export type AssetOrigin =
  | "USER"
  | "GENERATED"
  | "LOCAL"
  | "PROVIDER"
  | "CACHE"
  | "SYSTEM";

export type AssetLifecycle =
  | "REQUESTED"
  | "GENERATING"
  | "GENERATED"
  | "VALIDATING"
  | "READY"
  | "FAILED"
  | "EXPIRED"
  | "DELETED";

export interface AssetDimensions {
  width: number;
  height: number;
  aspectRatio?: string; // e.g. "16:9", "1:1", "9:16"
}

export interface IntelligentAsset {
  id: string;
  kind: AssetKind;
  origin: AssetOrigin;
  status: AssetLifecycle;
  mimeType: string;
  filePath: string;
  publicUrl: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  durationSeconds?: number;
  sizeBytes: number;
  checksum: string;     // SHA-256 hash of file content
  contentHash: string;  // Deterministic hash of generation parameters
  hasAlphaChannel?: boolean;
  createdAt: Date;
  updatedAt: Date;
  provider?: string;
  providerModel?: string;
  generationPrompt?: string;
  sourceReference?: string;
  licenseMetadata?: string;
  projectId?: string;
  sceneIds: string[];
  isReusable: boolean;
  isTemporary: boolean;
  isFallback: boolean;
  metadata: Record<string, any>;
}

export interface AssetRequirement {
  id: string;
  sceneId: string;
  shotId?: string;
  kind: AssetKind;
  semanticRole: string; // e.g. "background", "character-protagonist", "archival-map", "concept-diagram"
  prompt: string;
  styleDescription?: string;
  desiredDimensions?: AssetDimensions;
  requiresAlpha?: boolean;
  isOptional?: boolean;
  isReusable?: boolean;
  characterId?: string;
  metadata?: Record<string, any>;
}

export interface SceneAssetRequirements {
  sceneId: string;
  requirements: AssetRequirement[];
}

export interface AssetRequirementPlan {
  projectId: string;
  scenes: SceneAssetRequirements[];
  totalRequirements: number;
}

export interface AssetResolutionOptions {
  projectId?: string;
  sceneId?: string;
  taskId?: string;
  allowCache?: boolean;
  allowFallback?: boolean;
  preferredProvider?: string;
  isProduction?: boolean;
}

export interface AssetResolutionResult {
  requirementId: string;
  asset: IntelligentAsset;
  source: AssetOrigin;
  durationMs: number;
  cacheHit: boolean;
  error?: string;
}

export interface AssetManifestEntry {
  assetId: string;
  kind: AssetKind;
  origin: AssetOrigin;
  status: AssetLifecycle;
  filePath: string;
  publicUrl: string;
  checksum: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  hasAlphaChannel?: boolean;
  reusable: boolean;
  isFallback: boolean;
  sceneIds: string[];
}

export interface AssetManifest {
  taskId: string;
  projectId: string;
  timestamp: Date;
  totalAssets: number;
  cacheHitCount: number;
  generatedCount: number;
  fallbackCount: number;
  assets: AssetManifestEntry[];
}
