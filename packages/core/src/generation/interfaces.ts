import {
  GenerationRequest,
  GenerationResponse,
  GenerationTask,
  GeneratedAsset,
  AssetVersion,
  ProviderCapability,
  GenerationQueue,
  GenerationProgress,
  GenerationReport,
  GenerationSnapshot,
} from "./models";
import { GenerationProviderType } from "./GenerationProviderType";
import { AssetVersionState } from "./AssetVersionState";

// ─── Core Engine ─────────────────────────────────────────────────────────────

export interface IGenerationEngine {
  readonly state: string;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  generate(request: GenerationRequest): Promise<GenerationResponse>;
  queue(tasks: GenerationTask[]): Promise<GenerationQueue>;
  cancel(generationId: string): Promise<void>;
  retry(taskId: string): Promise<GeneratedAsset>;
  resume(generationId: string): Promise<GenerationResponse>;
  getProgress(generationId: string): GenerationProgress;
  getReport(generationId: string): GenerationReport;
  getHistory(): GenerationResponse[];
  getSnapshot(generationId: string): GenerationSnapshot;
}

// ─── Provider Router ─────────────────────────────────────────────────────────

export interface IProviderRouter {
  route(task: GenerationTask, capabilities: ProviderCapability[]): GenerationProviderType;
}

// ─── Asset Generator ─────────────────────────────────────────────────────────

export interface IAssetGenerator {
  generate(task: GenerationTask, provider: GenerationProviderType): Promise<GeneratedAsset>;
}

// ─── Queue Executor ───────────────────────────────────────────────────────────

export interface IQueueExecutor {
  execute(queue: GenerationQueue, generator: IAssetGenerator): Promise<GeneratedAsset[]>;
}

// ─── Dependency Resolver ──────────────────────────────────────────────────────

export interface IDependencyResolver {
  resolve(tasks: GenerationTask[]): GenerationTask[][];  // returns ordered batches
}

// ─── Version Manager ─────────────────────────────────────────────────────────

export interface IVersionManager {
  save(asset: GeneratedAsset, prompt: string, provider: GenerationProviderType): AssetVersion;
  activate(assetId: string, versionId: string): void;
  rollback(assetId: string, versionId: string): AssetVersion;
  listVersions(assetId: string): AssetVersion[];
  getActiveVersion(assetId: string): AssetVersion | undefined;
}
