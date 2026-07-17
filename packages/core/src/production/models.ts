import { ProductionState } from "./ProductionState";
import { AssetType } from "./AssetType";
import { AssetStatus } from "./AssetStatus";
import { ProductionPriority } from "./ProductionPriority";

export interface ProductionRequest {
  id: string;
  scriptId: string;
  state: ProductionState;
  timestamp: Date;
  options?: Record<string, any>;
}

export interface ProductionResponse {
  productionId: string;
  state: ProductionState;
  plan: ProductionPlan;
  timeline: ProductionTimeline;
  queue: GenerationQueue;
  reports: ProductionReport[];
  timestamp: Date;
}

export interface ProductionPlan {
  id: string;
  scenes: ProductionScene[];
  assets: ProductionAsset[];
  batches: string[][];
}

export interface ProductionScene {
  id: string;
  name: string;
  requirements: AssetRequirement[];
  durationSeconds: number;
}

export interface ProductionAsset {
  id: string;
  type: AssetType;
  status: AssetStatus;
  priority: ProductionPriority;
  dependencies: AssetDependency[];
  prompt?: string;
}

export interface AssetRequirement {
  type: AssetType;
  description: string;
  suggestedPrompt?: string;
}

export interface AssetDependency {
  assetId: string;
  type: string;
}

export interface GenerationQueue {
  id: string;
  items: string[];
}

export interface ProductionTimeline {
  scenes: Record<string, { start: number; end: number }>;
  assets: Record<string, { start: number; end: number }>;
  layers: Record<string, string[]>;
}

export interface ProductionReport {
  id: string;
  timestamp: Date;
  totalAssets: number;
  estimatedCost: number;
  estimatedRuntimeSeconds: number;
  gpuTimeSeconds: number;
  storageBytes: number;
  missingAssets: string[];
  warnings: string[];
}

export interface ProductionSnapshot {
  productionId: string;
  state: ProductionState;
  plan: Readonly<ProductionPlan>;
  timestamp: Date;
}
