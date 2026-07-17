import { AssetState } from "./AssetState";
import { AssetType } from "./AssetType";
import { PromptType } from "./PromptType";
import { MediaType } from "./MediaType";
import { VisualStyle } from "./VisualStyle";

export interface AssetRequest {
  id: string;
  scriptId: string;
  state: AssetState;
  timestamp: Date;
  options?: Record<string, any>;
}

export interface AssetResponse {
  productionId: string;
  state: AssetState;
  assets: ProductionAsset[];
  groups: AssetGroup[];
  styleGuide: StyleGuide;
  characters: CharacterProfile[];
  timeline: MediaTimeline;
  graph: DependencyGraph;
  reports: ProductionReport[];
  timestamp: Date;
}

export interface ProductionAsset {
  id: string;
  type: AssetType;
  name: string;
  priority: "LOW" | "NORMAL" | "HIGH";
  version: number;
  prompts: AssetPrompt[];
  dependencies: string[];
}

export interface AssetGroup {
  id: string;
  name: string;
  assetIds: string[];
}

export interface AssetPrompt {
  type: PromptType;
  promptText: string;
  version: number;
}

export interface CharacterProfile {
  id: string;
  name: string;
  type: "AVATAR" | "HUMAN" | "ANIMATED" | "MASCOT";
  visualSpec: string;
  voiceId: string;
}

export interface StyleGuide {
  visualStyle: VisualStyle;
  colorPalette: string[];
  lightingSpec: string;
  cameraLanguage: string;
  compositionRules: string[];
  lensSuggestions: string[];
  aspectRatio: string;
  resolution: string;
  renderQuality: string;
}

export interface MediaTimeline {
  shots: string[];
  assetTimings: Record<string, { start: number; duration: number }>;
  layerTimings: Record<string, string[]>;
  transitionTimings: Record<string, string>;
  overlayTimings: Record<string, { start: number; duration: number }>;
  subtitleTimings: Record<string, string>;
}

export interface DependencyGraph {
  nodeDependencies: Record<string, string[]>;
  generationOrder: string[];
  parallelSlots: string[][];
}

export interface ProductionReport {
  id: string;
  timestamp: Date;
  assetCount: number;
  promptCount: number;
  totalCostEstimate: number;
  renderTimeEstimateSeconds: number;
  optimizationsApplied: string[];
}

export interface ProductionSnapshot {
  productionId: string;
  state: AssetState;
  assets: ReadonlyArray<ProductionAsset>;
  styleGuide: Readonly<StyleGuide>;
  timestamp: Date;
}
