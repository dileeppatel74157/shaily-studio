import { IGenerationEngine, IProviderRouter, IAssetGenerator, IQueueExecutor, IDependencyResolver, IVersionManager } from "./interfaces";
import { GenerationState } from "./GenerationState";
import { GenerationType } from "./GenerationType";
import { GenerationProviderType } from "./GenerationProviderType";
import { GenerationPriority } from "./GenerationPriority";
import { AssetVersionState } from "./AssetVersionState";
import {
  GenerationRequest,
  GenerationResponse,
  GenerationTask,
  GeneratedAsset,
  AssetVersion,
  ProviderCapability,
  GenerationQueue,
  QueueBatch,
  GenerationProgress,
  GenerationCost,
  GenerationReport,
  GenerationSnapshot,
} from "./models";
import { GenerationValidator } from "./GenerationValidator";
import {
  GenerationException,
  GenerationValidationException,
  DuplicateGenerationException,
  InvalidGenerationStateException,
  deepFreeze,
} from "./types";

// ─── Default Provider Capabilities ────────────────────────────────────────────

const DEFAULT_CAPABILITIES: ProviderCapability[] = [
  {
    provider: GenerationProviderType.ELEVENLABS,
    supportedTypes: [GenerationType.VOICE],
    maxResolution: "N/A",
    gpuClass: "CPU",
    concurrency: 5,
    costPerUnit: 0.02,
    avgLatencyMs: 800,
    successRate: 0.97,
    available: true,
  },
  {
    provider: GenerationProviderType.STABILITY,
    supportedTypes: [GenerationType.IMAGE, GenerationType.BACKGROUND, GenerationType.THUMBNAIL],
    maxResolution: "2048x2048",
    gpuClass: "A100",
    concurrency: 3,
    costPerUnit: 0.04,
    avgLatencyMs: 2500,
    successRate: 0.95,
    available: true,
  },
  {
    provider: GenerationProviderType.RUNWAY,
    supportedTypes: [GenerationType.VIDEO],
    maxResolution: "1920x1080",
    gpuClass: "H100",
    concurrency: 2,
    costPerUnit: 0.15,
    avgLatencyMs: 8000,
    successRate: 0.92,
    available: true,
  },
  {
    provider: GenerationProviderType.OPENAI,
    supportedTypes: [GenerationType.TEXT, GenerationType.SUBTITLE, GenerationType.IMAGE],
    maxResolution: "1024x1024",
    gpuClass: "A100",
    concurrency: 10,
    costPerUnit: 0.01,
    avgLatencyMs: 1200,
    successRate: 0.98,
    available: true,
  },
  {
    provider: GenerationProviderType.GOOGLE,
    supportedTypes: [GenerationType.MUSIC, GenerationType.SFX],
    maxResolution: "N/A",
    gpuClass: "TPU",
    concurrency: 4,
    costPerUnit: 0.03,
    avgLatencyMs: 3000,
    successRate: 0.94,
    available: true,
  },
];

// ─── Default Provider Router ──────────────────────────────────────────────────

class DefaultProviderRouter implements IProviderRouter {
  public route(task: GenerationTask, capabilities: ProviderCapability[]): GenerationProviderType {
    const compatible = capabilities.filter(
      (c) => c.available && c.supportedTypes.includes(task.type)
    );
    if (compatible.length === 0) return task.provider; // fallback to original
    // Score by: successRate * 0.5 + (1 - costPerUnit/max) * 0.3 + (1 - avgLatencyMs/max) * 0.2
    const maxCost = Math.max(...compatible.map((c) => c.costPerUnit), 0.001);
    const maxLatency = Math.max(...compatible.map((c) => c.avgLatencyMs), 1);
    let best = compatible[0];
    let bestScore = -Infinity;
    for (const cap of compatible) {
      const score =
        cap.successRate * 0.5 +
        (1 - cap.costPerUnit / maxCost) * 0.3 +
        (1 - cap.avgLatencyMs / maxLatency) * 0.2;
      if (score > bestScore) {
        bestScore = score;
        best = cap;
      }
    }
    return best.provider;
  }
}

// ─── Default Asset Generator ─────────────────────────────────────────────────

class DefaultAssetGenerator implements IAssetGenerator {
  private readonly _failureMap = new Map<string, number>(); // taskId → failure count
  private readonly _forceFail: Set<string>;

  constructor(forceFailTaskIds: string[] = []) {
    this._forceFail = new Set(forceFailTaskIds);
  }

  public async generate(task: GenerationTask, provider: GenerationProviderType): Promise<GeneratedAsset> {
    if (this._forceFail.has(task.id)) {
      const count = (this._failureMap.get(task.id) || 0) + 1;
      this._failureMap.set(task.id, count);
      if (count <= 1) {
        throw new GenerationException(`Simulated failure for task "${task.id}".`);
      }
      // Allow on second try (retry test)
    }

    const typeToExt: Record<string, string> = {
      [GenerationType.IMAGE]: "png",
      [GenerationType.VIDEO]: "mp4",
      [GenerationType.VOICE]: "mp3",
      [GenerationType.MUSIC]: "wav",
      [GenerationType.SFX]: "wav",
      [GenerationType.SUBTITLE]: "srt",
      [GenerationType.TEXT]: "txt",
      [GenerationType.BACKGROUND]: "png",
      [GenerationType.THUMBNAIL]: "jpg",
    };

    return {
      id: `asset-${task.id}`,
      taskId: task.id,
      assetType: task.type,
      provider,
      prompt: task.prompt,
      parameters: task.parameters,
      filePath: `/assets/${task.id}.${typeToExt[task.type] || "bin"}`,
      checksum: `chk-${task.id}-${Date.now()}`,
      size: Math.floor(Math.random() * 5_000_000) + 100_000,
      resolution: task.type === GenerationType.IMAGE || task.type === GenerationType.BACKGROUND
        ? "1920x1080"
        : undefined,
      duration: task.type === GenerationType.VOICE || task.type === GenerationType.VIDEO
        ? Math.random() * 30 + 5
        : undefined,
      version: 1,
      createdAt: new Date(),
    };
  }
}

// ─── Default Dependency Resolver ─────────────────────────────────────────────

class DefaultDependencyResolver implements IDependencyResolver {
  public resolve(tasks: GenerationTask[]): GenerationTask[][] {
    // Topological sort → batches of independent tasks
    const taskMap = new Map<string, GenerationTask>(tasks.map((t) => [t.id, t]));
    const inDegree = new Map<string, number>(tasks.map((t) => [t.id, 0]));
    const dependents = new Map<string, string[]>(tasks.map((t) => [t.id, []]));

    for (const task of tasks) {
      for (const depId of task.dependsOn) {
        inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
        if (dependents.has(depId)) {
          dependents.get(depId)!.push(task.id);
        }
      }
    }

    const batches: GenerationTask[][] = [];
    let remaining = new Set(tasks.map((t) => t.id));

    while (remaining.size > 0) {
      const batch = [...remaining]
        .filter((id) => (inDegree.get(id) || 0) === 0)
        .sort((a, b) => {
          // Sort by priority within the same batch
          const priorityOrder = {
            [GenerationPriority.CRITICAL]: 0,
            [GenerationPriority.HIGH]: 1,
            [GenerationPriority.NORMAL]: 2,
            [GenerationPriority.LOW]: 3,
          };
          const tA = taskMap.get(a)!;
          const tB = taskMap.get(b)!;
          return (priorityOrder[tA.priority] ?? 2) - (priorityOrder[tB.priority] ?? 2);
        });

      if (batch.length === 0 && remaining.size > 0) {
        throw new GenerationValidationException("Circular dependency detected during resolution.");
      }

      batches.push(batch.map((id) => taskMap.get(id)!));

      for (const id of batch) {
        remaining.delete(id);
        for (const depId of dependents.get(id) || []) {
          inDegree.set(depId, (inDegree.get(depId) || 0) - 1);
        }
      }
    }

    return batches;
  }
}

// ─── Default Queue Executor ───────────────────────────────────────────────────

class DefaultQueueExecutor implements IQueueExecutor {
  public async execute(queue: GenerationQueue, generator: IAssetGenerator): Promise<GeneratedAsset[]> {
    const results: GeneratedAsset[] = [];
    for (const batch of queue.batches) {
      const batchResults = await Promise.all(
        batch.taskIds.map(async (id) => {
          const dummy: GenerationTask = {
            id,
            type: GenerationType.IMAGE,
            provider: GenerationProviderType.STABILITY,
            prompt: `Generate asset ${id}`,
            parameters: {},
            state: GenerationState.GENERATING,
            priority: GenerationPriority.NORMAL,
            dependsOn: [],
            retries: 0,
            maxRetries: 2,
          };
          return generator.generate(dummy, GenerationProviderType.STABILITY);
        })
      );
      results.push(...batchResults);
    }
    return results;
  }
}

// ─── Default Version Manager ──────────────────────────────────────────────────

class DefaultVersionManager implements IVersionManager {
  private readonly _versions = new Map<string, AssetVersion[]>(); // assetId → versions
  private readonly _activeVersions = new Map<string, string>(); // assetId → versionId

  public save(asset: GeneratedAsset, prompt: string, provider: GenerationProviderType): AssetVersion {
    const existing = this._versions.get(asset.id) || [];
    const version: AssetVersion = {
      id: `ver-${asset.id}-v${existing.length + 1}`,
      assetId: asset.id,
      versionNumber: existing.length + 1,
      state: AssetVersionState.DRAFT,
      filePath: asset.filePath,
      prompt,
      parameters: asset.parameters,
      provider,
      createdAt: new Date(),
    };
    existing.push(version);
    this._versions.set(asset.id, existing);
    if (!this._activeVersions.has(asset.id)) {
      this._activeVersions.set(asset.id, version.id);
    }
    return version;
  }

  public activate(assetId: string, versionId: string): void {
    const versions = this._versions.get(assetId) || [];
    const target = versions.find((v) => v.id === versionId);
    if (!target) throw new GenerationException(`Version "${versionId}" not found for asset "${assetId}".`);
    versions.forEach((v) => {
      v.state = v.id === versionId ? AssetVersionState.ACTIVE : AssetVersionState.ARCHIVED;
    });
    this._activeVersions.set(assetId, versionId);
  }

  public rollback(assetId: string, versionId: string): AssetVersion {
    this.activate(assetId, versionId);
    const versions = this._versions.get(assetId) || [];
    return versions.find((v) => v.id === versionId)!;
  }

  public listVersions(assetId: string): AssetVersion[] {
    return this._versions.get(assetId) || [];
  }

  public getActiveVersion(assetId: string): AssetVersion | undefined {
    const versionId = this._activeVersions.get(assetId);
    if (!versionId) return undefined;
    return (this._versions.get(assetId) || []).find((v) => v.id === versionId);
  }
}

// ─── Generation Engine ────────────────────────────────────────────────────────

export class GenerationEngine implements IGenerationEngine {
  private _state = GenerationState.CREATED;
  private readonly _requests = new Map<string, GenerationRequest>();
  private readonly _responses = new Map<string, GenerationResponse>();
  private readonly _history: GenerationResponse[] = [];
  private readonly _snapshots = new Map<string, GenerationSnapshot>();
  private readonly _progressMap = new Map<string, GenerationProgress>();
  private readonly _reportMap = new Map<string, GenerationReport>();
  private readonly _cache = new Map<string, GeneratedAsset>(); // cacheKey → asset
  private readonly _cancelledIds = new Set<string>();
  private readonly _resumeCheckpoints = new Map<string, string>(); // generationId → lastTaskId

  private readonly _capabilities: ProviderCapability[];
  private readonly _providerRouter: IProviderRouter;
  private readonly _assetGenerator: IAssetGenerator;
  private readonly _queueExecutor: IQueueExecutor;
  private readonly _dependencyResolver: IDependencyResolver;
  private readonly _versionManager: IVersionManager;

  constructor(
    public readonly context: any,
    public readonly configuration?: any,
    public readonly metadata: Record<string, unknown> = {},
    capabilities?: ProviderCapability[],
    providerRouter?: IProviderRouter,
    assetGenerator?: IAssetGenerator,
    queueExecutor?: IQueueExecutor,
    dependencyResolver?: IDependencyResolver,
    versionManager?: IVersionManager
  ) {
    this._capabilities = capabilities || DEFAULT_CAPABILITIES;
    this._providerRouter = providerRouter || new DefaultProviderRouter();
    this._assetGenerator = assetGenerator || new DefaultAssetGenerator();
    this._queueExecutor = queueExecutor || new DefaultQueueExecutor();
    this._dependencyResolver = dependencyResolver || new DefaultDependencyResolver();
    this._versionManager = versionManager || new DefaultVersionManager();
  }

  public get state(): GenerationState {
    return this._state;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  public async initialize(): Promise<void> {
    if (this._state !== GenerationState.CREATED) {
      throw new InvalidGenerationStateException("engine", "initialize", this._state);
    }
    this._state = GenerationState.INITIALIZED;
    if (this.context.logger) this.context.logger.info("GenerationEngine initialized.");
  }

  public async start(): Promise<void> {
    if (this._state !== GenerationState.INITIALIZED && this._state !== GenerationState.CANCELLED) {
      throw new InvalidGenerationStateException("engine", "start", this._state);
    }
    this._state = GenerationState.QUEUED;
    if (this.context.logger) this.context.logger.info("GenerationEngine started.");
  }

  public async stop(): Promise<void> {
    if (this._state === GenerationState.CREATED) {
      throw new InvalidGenerationStateException("engine", "stop", this._state);
    }
    this._state = GenerationState.CANCELLED;
    if (this.context.logger) this.context.logger.info("GenerationEngine stopped.");
  }

  // ─── Queue ─────────────────────────────────────────────────────────────────

  public async queue(tasks: GenerationTask[]): Promise<GenerationQueue> {
    const orderedBatches = this._dependencyResolver.resolve(tasks);
    const queueBatches: QueueBatch[] = orderedBatches.map((batch, idx) => ({
      id: `batch-${idx + 1}`,
      taskIds: batch.map((t) => t.id),
      parallelLimit: 4,
      state: GenerationState.QUEUED,
    }));
    return {
      id: `queue-${Date.now()}`,
      batches: queueBatches,
      pendingItems: tasks.map((t) => t.id),
      completedItems: [],
      failedItems: [],
    };
  }

  // ─── Cancel ────────────────────────────────────────────────────────────────

  public async cancel(generationId: string): Promise<void> {
    this._cancelledIds.add(generationId);
    const response = this._responses.get(generationId);
    if (response) {
      (response as any).state = GenerationState.CANCELLED;
    }
    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: `evt-gen-cancel-${Math.random().toString(36).substring(2, 9)}`,
        name: "GenerationCancelled",
        timestamp: new Date(),
        correlationId: generationId,
        source: "GenerationEngine",
        payload: { generationId },
        metadata: {},
      });
    }
  }

  // ─── Retry ─────────────────────────────────────────────────────────────────

  public async retry(taskId: string): Promise<GeneratedAsset> {
    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: `evt-retry-${Math.random().toString(36).substring(2, 9)}`,
        name: "RetryStarted",
        timestamp: new Date(),
        correlationId: taskId,
        source: "GenerationEngine",
        payload: { taskId },
        metadata: {},
      });
    }
    // Find the task in request history and re-run
    for (const [, req] of this._requests) {
      const task = req.tasks.find((t) => t.id === taskId);
      if (task) {
        const provider = this._providerRouter.route(task, this._capabilities);
        return this._assetGenerator.generate({ ...task, retries: task.retries + 1 }, provider);
      }
    }
    throw new GenerationException(`Task "${taskId}" not found for retry.`);
  }

  // ─── Resume ────────────────────────────────────────────────────────────────

  public async resume(generationId: string): Promise<GenerationResponse> {
    const originalRequest = this._requests.get(generationId);
    if (!originalRequest) {
      throw new GenerationException(`No generation found with ID "${generationId}" to resume.`);
    }
    // Find tasks that have not yet produced assets in any prior response
    const completedTaskIds = new Set<string>(
      this._history.flatMap((h) => h.assets.map((a) => a.taskId))
    );
    const remainingTasks = originalRequest.tasks.filter((t) => !completedTaskIds.has(t.id));
    // If everything was already completed, re-run all (idempotent resume)
    const tasksToRun = remainingTasks.length > 0 ? remainingTasks : originalRequest.tasks;

    return this.generate({
      ...originalRequest,
      id: `${generationId}-resumed`,
      tasks: tasksToRun,
    });
  }

  // ─── Progress / Report ─────────────────────────────────────────────────────

  public getProgress(generationId: string): GenerationProgress {
    return (
      this._progressMap.get(generationId) || {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        cancelledTasks: 0,
        percentage: 0,
        perBatch: {},
        perProvider: {},
      }
    );
  }

  public getReport(generationId: string): GenerationReport {
    const report = this._reportMap.get(generationId);
    if (!report) throw new GenerationException(`No report found for generation "${generationId}".`);
    return report;
  }

  public getHistory(): GenerationResponse[] {
    return [...this._history];
  }

  public getSnapshot(generationId: string): GenerationSnapshot {
    const snapshot = this._snapshots.get(generationId);
    if (!snapshot) throw new GenerationException(`No snapshot found for generation "${generationId}".`);
    return snapshot;
  }

  // ─── Core Generate ─────────────────────────────────────────────────────────

  public async generate(request: GenerationRequest): Promise<GenerationResponse> {
    // Validate engine state
    if (
      this._state !== GenerationState.QUEUED &&
      this._state !== GenerationState.INITIALIZED &&
      this._state !== GenerationState.GENERATING
    ) {
      throw new InvalidGenerationStateException(request.id, "generate", this._state);
    }

    // Validate request
    GenerationValidator.validateRequest(request);

    // Duplicate check
    if (this._requests.has(request.id)) {
      throw new DuplicateGenerationException(request.id);
    }
    this._requests.set(request.id, request);

    // Memory cache check
    if (this.context.memoryStore) {
      const cached = await this.context.memoryStore.get("generation-memory", `gen:${request.id}`);
      if (cached && request.options?.allowCached) {
        return cached.value as GenerationResponse;
      }
    }

    // Publish GenerationStarted
    await this._publishEvent("GenerationStarted", request.id, { requestId: request.id, taskCount: request.tasks.length });

    this._state = GenerationState.GENERATING;

    const assets: GeneratedAsset[] = [];
    const costPerTask: Record<string, number> = {};
    const providerBreakdown: Record<string, number> = {};
    let totalRetries = 0;
    let failedCount = 0;

    // Sort tasks by dependency order
    const orderedBatches = this._dependencyResolver.resolve(request.tasks);

    // Build queue
    const genQueue = await this.queue(request.tasks);
    GenerationValidator.validateQueue(genQueue, request.tasks);

    // Track progress
    const progress: GenerationProgress = {
      totalTasks: request.tasks.length,
      completedTasks: 0,
      failedTasks: 0,
      cancelledTasks: 0,
      percentage: 0,
      perBatch: {},
      perProvider: {},
    };

    // Execute batch by batch
    for (let batchIdx = 0; batchIdx < orderedBatches.length; batchIdx++) {
      const batchTasks = orderedBatches[batchIdx];
      const batchId = `batch-${batchIdx + 1}`;

      // Publish batch started implicitly as each task starts
      await Promise.all(
        batchTasks.map(async (task) => {
          if (this._cancelledIds.has(request.id)) return;

          // Cache lookup
          const cacheKey = task.cacheKey || `${task.type}::${task.prompt}::${JSON.stringify(task.parameters)}`;
          if (this._cache.has(cacheKey)) {
            const cachedAsset = this._cache.get(cacheKey)!;
            assets.push(cachedAsset);
            progress.completedTasks++;
            return;
          }

          // Provider routing (auto-select best provider)
          const selectedProvider = this._providerRouter.route(task, this._capabilities);

          // Publish AssetQueued → AssetGenerating
          await this._publishEvent("AssetQueued", request.id, { taskId: task.id });
          await this._publishEvent("AssetGenerating", request.id, { taskId: task.id, provider: selectedProvider });

          let asset: GeneratedAsset | undefined;
          let lastError: string | undefined;
          let retried = 0;
          const maxRetries = request.options?.maxRetries ?? task.maxRetries ?? 2;

          // Retry loop with provider fallback
          while (retried <= maxRetries) {
            try {
              asset = await this._assetGenerator.generate(task, selectedProvider);
              break;
            } catch (err: any) {
              lastError = err.message;
              retried++;
              totalRetries++;
              if (retried <= maxRetries) {
                await this._publishEvent("RetryStarted", request.id, { taskId: task.id, attempt: retried });
                // Provider failover — try the next available compatible provider
                const fallbackCaps = this._capabilities.filter(
                  (c) => c.available && c.supportedTypes.includes(task.type) && c.provider !== selectedProvider
                );
                if (fallbackCaps.length > 0) {
                  try {
                    asset = await this._assetGenerator.generate(task, fallbackCaps[0].provider);
                    break;
                  } catch (_) {
                    // Continue retry
                  }
                }
              }
            }
          }

          if (!asset) {
            failedCount++;
            progress.failedTasks++;
            genQueue.failedItems.push(task.id);
            await this._publishEvent("AssetFailed", request.id, { taskId: task.id, error: lastError });
          } else {
            // Save version
            this._versionManager.save(asset, task.prompt, selectedProvider);
            this._versionManager.activate(asset.id, `ver-${asset.id}-v1`);

            // Cache result
            this._cache.set(cacheKey, asset);
            this._resumeCheckpoints.set(request.id, task.id);

            assets.push(asset);
            genQueue.completedItems.push(task.id);
            genQueue.pendingItems.splice(genQueue.pendingItems.indexOf(task.id), 1);

            // Cost estimation (mock: costPerUnit * 1 unit)
            const cap = this._capabilities.find((c) => c.provider === selectedProvider);
            const cost = cap ? cap.costPerUnit : 0.05;
            costPerTask[task.id] = cost;
            providerBreakdown[selectedProvider] = (providerBreakdown[selectedProvider] || 0) + 1;

            progress.completedTasks++;
            progress.perProvider[selectedProvider] =
              Math.round(((providerBreakdown[selectedProvider] || 0) / request.tasks.length) * 100);

            await this._publishEvent("AssetCompleted", request.id, { taskId: task.id, assetId: asset.id });
          }

          progress.percentage = Math.round((progress.completedTasks / progress.totalTasks) * 100);
          progress.perBatch[batchId] = progress.percentage;
          this._progressMap.set(request.id, { ...progress });
        })
      );
    }

    // Build cost summary
    const totalApiCost = Object.values(costPerTask).reduce((a, b) => a + b, 0);
    const generationCost: GenerationCost = {
      totalTokens: assets.length * 1000,
      apiCost: parseFloat(totalApiCost.toFixed(4)),
      gpuMinutes: assets.length * 0.5,
      storageBytes: assets.reduce((a, b) => a + b.size, 0),
      perTask: costPerTask,
    };

    // Build report
    const report: GenerationReport = {
      id: `report-${request.id}`,
      timestamp: new Date(),
      totalAssets: request.tasks.length,
      succeeded: assets.length,
      failed: failedCount,
      retries: totalRetries,
      cost: generationCost,
      providerBreakdown,
      warnings: failedCount > 0 ? [`${failedCount} asset(s) failed to generate.`] : [],
    };

    // Validate response
    if (assets.length === 0) {
      throw new GenerationValidationException(
        `GenerationResponse for "${request.id}" produced no assets.`
      );
    }

    const response: GenerationResponse = {
      id: `gen-response-${request.id}`,
      requestId: request.id,
      state: failedCount === 0 ? GenerationState.COMPLETED : GenerationState.FAILED,
      tasks: request.tasks,
      assets,
      progress,
      cost: generationCost,
      report,
      timestamp: new Date(),
    };

    GenerationValidator.validateResponse(response);

    // Snapshot
    const snapshot: GenerationSnapshot = {
      generationId: request.id,
      state: response.state,
      assets: response.assets,
      cost: generationCost,
      timestamp: response.timestamp,
    };
    deepFreeze(snapshot);
    this._snapshots.set(request.id, snapshot);

    // Store report & progress
    this._reportMap.set(request.id, report);
    this._progressMap.set(request.id, progress);

    // Memory storage
    if (this.context.memoryStore) {
      await this.context.memoryStore.set(
        "generation-memory",
        `gen:${request.id}`,
        response,
        { generationId: request.id, totalAssets: assets.length }
      );
    }

    // Store response & history
    this._responses.set(request.id, response);
    this._history.push(response);

    // Publish QueueFinished
    await this._publishEvent("QueueFinished", request.id, {
      total: request.tasks.length,
      succeeded: assets.length,
      failed: failedCount,
    });

    this._state = GenerationState.QUEUED; // restore to accept more requests
    return response;
  }

  // ─── Internal Event Publisher ─────────────────────────────────────────────

  private async _publishEvent(name: string, correlationId: string, payload: any): Promise<void> {
    if (this.context.eventBus) {
      try {
        await this.context.eventBus.publish({
          id: `evt-${name.toLowerCase()}-${Math.random().toString(36).substring(2, 9)}`,
          name,
          timestamp: new Date(),
          correlationId,
          source: "GenerationEngine",
          payload,
          metadata: {},
        });
      } catch (_) {
        // Non-fatal — event bus errors don't abort generation
      }
    }
  }
}
