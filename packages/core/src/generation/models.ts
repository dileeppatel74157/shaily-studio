import { GenerationState } from "./GenerationState";
import { GenerationType } from "./GenerationType";
import { GenerationProviderType } from "./GenerationProviderType";
import { GenerationPriority } from "./GenerationPriority";
import { AssetVersionState } from "./AssetVersionState";

// ─── Master Request ───────────────────────────────────────────────────────────

export interface GenerationRequest {
  id: string;
  productionPlanId?: string;
  tasks: GenerationTask[];
  state: GenerationState;
  timestamp: Date;
  options?: {
    correlationId?: string;
    allowCached?: boolean;
    retryTaskId?: string;
    resumeFromTaskId?: string;
    brandContext?: BrandContext;
    maxRetries?: number;
    parallelLimit?: number;
  };
}

// ─── Overall Response ─────────────────────────────────────────────────────────

export interface GenerationResponse {
  id: string;
  requestId: string;
  state: GenerationState;
  tasks: GenerationTask[];
  assets: GeneratedAsset[];
  progress: GenerationProgress;
  cost: GenerationCost;
  report: GenerationReport;
  timestamp: Date;
}

// ─── Single Asset Generation Job ──────────────────────────────────────────────

export interface GenerationTask {
  id: string;
  type: GenerationType;
  provider: GenerationProviderType;
  prompt: string;
  parameters: Record<string, any>;
  state: GenerationState;
  priority: GenerationPriority;
  dependsOn: string[]; // task IDs
  retries: number;
  maxRetries: number;
  cacheKey?: string;
  error?: string;
  assetId?: string;
}

// ─── Generated Asset Metadata ─────────────────────────────────────────────────

export interface GeneratedAsset {
  id: string;
  taskId: string;
  assetType: GenerationType;
  provider: GenerationProviderType;
  prompt: string;
  parameters: Record<string, any>;
  filePath: string;
  checksum: string;
  size: number;        // bytes
  resolution?: string; // e.g. "1920x1080"
  duration?: number;   // seconds (audio/video)
  version: number;
  createdAt: Date;
}

// ─── Asset Version ────────────────────────────────────────────────────────────

export interface AssetVersion {
  id: string;
  assetId: string;
  versionNumber: number;
  state: AssetVersionState;
  filePath: string;
  prompt: string;
  parameters: Record<string, any>;
  provider: GenerationProviderType;
  createdAt: Date;
}

// ─── Provider Capability ──────────────────────────────────────────────────────

export interface ProviderCapability {
  provider: GenerationProviderType;
  supportedTypes: GenerationType[];
  maxResolution: string;
  gpuClass: string;
  concurrency: number;
  costPerUnit: number;   // USD per generation unit
  avgLatencyMs: number;
  successRate: number;   // 0.0 – 1.0
  available: boolean;
}

// ─── Generation Queue ─────────────────────────────────────────────────────────

export interface GenerationQueue {
  id: string;
  batches: QueueBatch[];
  pendingItems: string[];   // task IDs not yet processed
  completedItems: string[]; // task IDs finished
  failedItems: string[];    // task IDs failed
}

// ─── Queue Batch ──────────────────────────────────────────────────────────────

export interface QueueBatch {
  id: string;
  taskIds: string[];
  parallelLimit: number;
  state: GenerationState;
}

// ─── Dependency Graph ─────────────────────────────────────────────────────────

export interface DependencyNode {
  taskId: string;
  dependsOn: string[];
  dependents: string[];
}

export interface GenerationDependencyGraph {
  nodes: Map<string, DependencyNode>;
}

// ─── Generation Progress ──────────────────────────────────────────────────────

export interface GenerationProgress {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  cancelledTasks: number;
  percentage: number; // 0–100
  perBatch: Record<string, number>;      // batchId → percentage
  perProvider: Record<string, number>;   // provider → percentage
  currentTask?: string;
}

// ─── Generation Cost ──────────────────────────────────────────────────────────

export interface GenerationCost {
  totalTokens: number;
  apiCost: number;       // USD
  gpuMinutes: number;
  storageBytes: number;
  perTask: Record<string, number>; // taskId → USD cost
}

// ─── Generation Report ────────────────────────────────────────────────────────

export interface GenerationReport {
  id: string;
  timestamp: Date;
  totalAssets: number;
  succeeded: number;
  failed: number;
  retries: number;
  cost: GenerationCost;
  providerBreakdown: Record<string, number>; // provider → asset count
  warnings: string[];
}

// ─── Immutable Snapshot ───────────────────────────────────────────────────────

export interface GenerationSnapshot {
  generationId: string;
  state: GenerationState;
  assets: Readonly<GeneratedAsset[]>;
  cost: Readonly<GenerationCost>;
  timestamp: Date;
}

// ─── Brand Context (from ChannelEngine) ──────────────────────────────────────

export interface BrandContext {
  colorPalette: string[];
  typography: string;
  logoGuidelines?: string;
  styleNotes?: string;
}
