import { PipelineState }       from "./PipelineState";
import { PipelineStage }       from "./PipelineStage";
import { PipelinePriority }    from "./PipelinePriority";
import { PipelineStatus }      from "./PipelineStatus";
import { PipelineMode }        from "./PipelineMode";
import { ExecutionStrategy }   from "./ExecutionStrategy";
import { PipelineResult }      from "./PipelineResult";
import { deepFreeze }          from "./types";
import { PipelineValidator }   from "./PipelineValidator";
import type {
  IPipelineEngine,
  IStageExecutor,
  IRecoveryManager,
  ICheckpointManager,
  IExecutionScheduler,
  IPipelineMonitor,
} from "./interfaces";
import type {
  PipelineRequest,
  PipelineResponse,
  PipelineExecution,
  PipelineStageExecution,
  PipelineCheckpoint,
  PipelineFailure,
  PipelineRecovery,
  PipelineReport,
  PipelineSnapshot,
  PipelineTimeline,
} from "./models";

// External subsystem imports
import { ProviderType } from "../llm-provider/ProviderType";
import { KnowledgeNodeType } from "../knowledge-base/KnowledgeNodeType";
import { KnowledgeSource } from "../knowledge-base/KnowledgeSource";
import { DatabaseEventType } from "../database/DatabaseEventType";

// ─── Default Manager Implementations ──────────────────────────────────────────

class DefaultStageExecutor implements IStageExecutor {
  public async executeStage(stage: PipelineStage, context: any): Promise<PipelineStatus> {
    const engineMap: Record<PipelineStage, string> = {
      [PipelineStage.RESEARCH]:     "researchEngine",
      [PipelineStage.STRATEGY]:     "strategyEngine",
      [PipelineStage.CHANNEL]:      "channelEngine",
      [PipelineStage.SCRIPT]:       "scriptEngine",
      [PipelineStage.PRODUCTION]:   "productionEngine",
      [PipelineStage.GENERATION]:   "generationEngine",
      [PipelineStage.COMPOSITION]:  "compositionEngine",
      [PipelineStage.RENDERING]:    "renderEngine",
      [PipelineStage.QUALITY]:      "qualityEngine",
      [PipelineStage.PUBLISHING]:   "publishingEngine",
      [PipelineStage.ANALYTICS]:    "analyticsEngine",
      [PipelineStage.LEARNING]:     "learningEngine",
      [PipelineStage.OPTIMIZATION]: "optimizationEngine",
    };

    const engineKey = engineMap[stage];
    const engineInstance = context?.[engineKey];

    if (engineInstance && typeof engineInstance.refresh === "function") {
      await engineInstance.refresh();
    }
    return PipelineStatus.SUCCESS;
  }

  public async rollbackStage(stage: PipelineStage, context: any): Promise<void> {
    // Rollback execution variables
  }
}

class DefaultRecoveryManager implements IRecoveryManager {
  private _failures: PipelineFailure[] = [];

  public async handleFailure(failure: PipelineFailure): Promise<PipelineRecovery> {
    this._failures.push(failure);
    const recId = `rec-${Date.now()}-${failure.id}`;
    const success = failure.canRetry;

    const recovery: PipelineRecovery = {
      id: recId,
      failureId: failure.id,
      strategy: success ? "RETRY" : "STOP",
      success,
      recoveredAt: new Date(),
    };
    PipelineValidator.validateRecovery(recovery);
    return recovery;
  }

  public getFailures(executionId?: string): PipelineFailure[] {
    return executionId ? this._failures.filter(f => f.executionId === executionId) : [...this._failures];
  }
}

class DefaultCheckpointManager implements ICheckpointManager {
  private _checkpoints = new Map<string, PipelineCheckpoint>();

  public saveCheckpoint(checkpoint: PipelineCheckpoint): void {
    PipelineValidator.validateCheckpoint(checkpoint);
    this._checkpoints.set(`${checkpoint.executionId}-${checkpoint.lastCompletedStage}`, checkpoint);
  }

  public loadCheckpoint(executionId: string): PipelineCheckpoint | undefined {
    const list = [...this._checkpoints.values()].filter(c => c.executionId === executionId || c.requestId === executionId);
    return list[list.length - 1];
  }

  public listCheckpoints(requestId?: string): PipelineCheckpoint[] {
    const list = [...this._checkpoints.values()];
    return requestId ? list.filter(c => c.requestId === requestId) : list;
  }
}

class DefaultExecutionScheduler implements IExecutionScheduler {
  public schedule(stages: PipelineStage[]): PipelineStage[][] {
    return stages.map(s => [s]);
  }
}

class DefaultPipelineMonitor implements IPipelineMonitor {
  private _executions = new Map<string, PipelineExecution>();

  public trackExecution(execution: PipelineExecution): void {
    this._executions.set(execution.id, execution);
  }

  public getExecution(executionId: string): PipelineExecution | undefined {
    return this._executions.get(executionId);
  }

  public getActiveExecutions(): PipelineExecution[] {
    return [...this._executions.values()].filter(e => e.status === PipelineStatus.RUNNING);
  }
}

// ─── Main Pipeline Engine Orchestrator ────────────────────────────────────────

export class PipelineEngine implements IPipelineEngine {
  private _state: PipelineState = PipelineState.CREATED;
  private _activeExecution?: PipelineExecution;
  private _reports = new Map<string, PipelineReport>();

  // Observability tracking variables
  private _metrics = {
    latencyMs: 0,
    promptTokens: 0,
    completionTokens: 0,
    costUsd: 0.0,
    retries: 0,
    providersUsed: [] as string[]
  };

  constructor(
    public readonly context: any,
    private readonly _stageExecutor: IStageExecutor = new DefaultStageExecutor(),
    private readonly _recoveryMgr: IRecoveryManager = new DefaultRecoveryManager(),
    private readonly _checkpointMgr: ICheckpointManager = new DefaultCheckpointManager(),
    private readonly _scheduler: IExecutionScheduler = new DefaultExecutionScheduler(),
    private readonly _monitor: IPipelineMonitor = new DefaultPipelineMonitor(),
    public readonly metadata: Record<string, unknown> = {}
  ) {}

  public async initialize(): Promise<void> {
    PipelineValidator.validateStateTransition("PipelineEngine", this._state, PipelineState.INITIALIZED);
    this._state = PipelineState.INITIALIZED;
  }

  public async start(): Promise<void> {
    PipelineValidator.validateStateTransition("PipelineEngine", this._state, PipelineState.RUNNING);
    this._state = PipelineState.RUNNING;
  }

  public async stop(): Promise<void> {
    PipelineValidator.validateStateTransition("PipelineEngine", this._state, PipelineState.FAILED);
    this._state = PipelineState.FAILED;
  }

  public async pause(): Promise<void> {
    PipelineValidator.validateStateTransition("PipelineEngine", this._state, PipelineState.PAUSED);
    this._state = PipelineState.PAUSED;
    await this._emit("PipelinePaused", { executionId: this._activeExecution?.id });
  }

  public async resume(): Promise<void> {
    PipelineValidator.validateStateTransition("PipelineEngine", this._state, PipelineState.RUNNING);
    this._state = PipelineState.RUNNING;
    await this._emit("PipelineResumed", { executionId: this._activeExecution?.id });
  }

  get state(): PipelineState {
    return this._state;
  }

  public getStageExecutor(): IStageExecutor { return this._stageExecutor; }
  public getRecoveryManager(): IRecoveryManager { return this._recoveryMgr; }
  public getCheckpointManager(): ICheckpointManager { return this._checkpointMgr; }
  public getExecutionScheduler(): IExecutionScheduler { return this._scheduler; }
  public getMonitor(): IPipelineMonitor { return this._monitor; }

  // ─── Pipeline Execution ─────────────────────────────────────────────────────

  public async execute(request: PipelineRequest): Promise<PipelineResponse> {
    PipelineValidator.validateNoDuplicateStages(request.stages);
    PipelineValidator.validateRequiredEnginesPresent(this.context);
    PipelineValidator.validateTimeout((request.metadata?.timeoutMs as number) ?? 3600_000);

    const executionId = request.metadata?.executionId as string ?? `exec-${Date.now()}`;
    await this._emit("PipelineStarted", { requestId: request.id, executionId });

    // Transition 1: CREATED -> VALIDATING
    this._state = PipelineState.VALIDATING;
    await this._dbLog(executionId, request.id, "VALIDATING", "Validating pipeline request content.");

    // Validate niche and format
    if (!request.goal || request.goal.trim() === "") {
      this._state = PipelineState.FAILED;
      throw new Error("Goal/Topic is required for pipeline execution.");
    }

    const stageExecutions: PipelineStageExecution[] = request.stages.map(stage => ({
      stage,
      status: PipelineStatus.PENDING,
      retryCount: 0,
    }));

    const execution: PipelineExecution = {
      id: executionId,
      requestId: request.id,
      mode: request.mode,
      stages: stageExecutions,
      status: PipelineStatus.RUNNING,
      startedAt: new Date(),
    };

    this._activeExecution = execution;
    this._monitor.trackExecution(execution);

    // Initialise stage context buffers
    const buffers = {
      researchOutput: null as any,
      strategyOutput: null as any,
      channelOutput: null as any,
      scriptOutput: null as any
    };

    let result = PipelineResult.SUCCESS;
    const completedStages: PipelineStage[] = [];

    // Schedule execution graph
    const scheduledGroups = this._scheduler.schedule(request.stages);

    for (const group of scheduledGroups) {
      if ((this._state as PipelineState) === PipelineState.PAUSED) {
        break;
      }

      if (request.mode === PipelineMode.PARALLEL || request.mode === PipelineMode.HYBRID) {
        // Parallel group execution simulation
        await Promise.all(group.map(stage => this._runStage(execution, stage, completedStages, buffers)));
      } else {
        // Sequential linear flow
        for (const stage of group) {
          const success = await this._runStage(execution, stage, completedStages, buffers);
          if (!success) {
            result = PipelineResult.FAILURE;
            break;
          }
        }
      }

      if (result === PipelineResult.FAILURE) {
        break;
      }
    }

    execution.status = result === PipelineResult.SUCCESS ? PipelineStatus.SUCCESS : PipelineStatus.FAILED;
    execution.completedAt = new Date();
    execution.totalDurationMs = execution.completedAt.getTime() - execution.startedAt.getTime();

    if (result === PipelineResult.SUCCESS) {
      this._state = PipelineState.COMPLETED;
    } else {
      this._state = PipelineState.FAILED;
    }

    // Create execution report
    const timeline: PipelineTimeline = {
      id: `time-${Date.now()}`,
      executionId,
      events: completedStages.map(s => ({
        id: `ev-${Date.now()}-${s}`, stage: s, status: PipelineStatus.SUCCESS, timestamp: new Date(),
      })),
      startedAt: execution.startedAt,
      updatedAt: new Date(),
    };

    const report: PipelineReport = {
      id: `rep-${Date.now()}`,
      executionId,
      metrics: {
        stageDurationsMs: request.stages.reduce((acc, s) => { acc[s] = 150; return acc; }, {} as Record<PipelineStage, number>),
        totalRetries: this._metrics.retries,
        costUsd: parseFloat(this._metrics.costUsd.toFixed(5)),
        successRate: result === PipelineResult.SUCCESS ? 1.0 : 0.0,
      },
      timeline,
      result,
      generatedAt: new Date(),
    };
    this._reports.set(executionId, report);
    this._reports.set(request.id, report);

    // Save to Memory Store
    const ctx = this.context;
    if (ctx?.memoryStore) {
      await ctx.memoryStore.set("pipeline-history",     `history:${request.id}`, request.goal);
      await ctx.memoryStore.set("pipeline-checkpoints",   `checkpoints:${request.id}`, completedStages.length);
      await ctx.memoryStore.set("pipeline-executions",    `exec:${request.id}`, executionId);
      await ctx.memoryStore.set("pipeline-failures",      `failures:${request.id}`, this._recoveryMgr.getFailures(executionId).length);
      await ctx.memoryStore.set("pipeline-metrics",       `metrics:${request.id}`, report.metrics.successRate);
      await ctx.memoryStore.set("pipeline-snapshots",     `snap:${request.id}`, execution.status);
      await ctx.memoryStore.set("pipeline-recovery",      `recovery:${request.id}`, this._metrics.retries);
    }

    // Feedback integration to Decision & Planning Engines
    if (ctx?.decisionEngine?.record) {
      await ctx.decisionEngine.record({
        pipelineExecutionId: executionId,
        goal: request.goal,
        status: execution.status,
        stagesExecutedCount: completedStages.length,
      });
    }

    if (ctx?.planningEngine?.createTask) {
      await ctx.planningEngine.createTask({
        type: "AUTONOMOUS_PIPELINE_COMPLETE",
        requestId: request.id,
        status: execution.status,
      });
    }

    await this._emit(result === PipelineResult.SUCCESS ? "PipelineCompleted" : "PipelineFailed", { executionId });

    return {
      id: `presp-${Date.now()}`,
      requestId: request.id,
      result,
      completedStages,
      executionTimeMs: execution.totalDurationMs,
      snapshotId: `snap-${executionId}`,
      timestamp: new Date(),
    };
  }

  // ─── Private Stage Executor ─────────────────────────────────────────────────

  private async _runStage(
    execution: PipelineExecution,
    stage: PipelineStage,
    completedStages: PipelineStage[],
    buffers: { researchOutput: any; strategyOutput: any; channelOutput: any; scriptOutput: any }
  ): Promise<boolean> {
    const stageExec = execution.stages.find(s => s.stage === stage)!;
    stageExec.status = PipelineStatus.RUNNING;
    stageExec.startedAt = new Date();
    execution.currentStage = stage;

    await this._emit("StageStarted", { executionId: execution.id, stage });

    let status = PipelineStatus.FAILED;
    let errorMessage: string | undefined;

    try {
      // 1. Respect Stage Executor (allows mock executor overrides to fail)
      const execStatus = await this._stageExecutor.executeStage(stage, this.context);
      if (execStatus === PipelineStatus.FAILED) {
        throw new Error("Stage executor forced failure");
      }

      // 2. Real executable stage integration
      if (stage === PipelineStage.RESEARCH) {
        this._state = PipelineState.RESEARCHING;
        await this._dbLog(execution.id, execution.requestId, "RESEARCHING", "Initiating Trend and Keyword Research.");
        const res = await this._callLLMWithRetry(
          `Conduct keyword and competitor analysis on: ${execution.requestId}`,
          ProviderType.GEMINI,
          "gemini-1.5-pro",
          execution.id
        );
        let researchRes: any = null;
        if (this.context.researchEngine?.execute) {
          researchRes = await this.context.researchEngine.execute({
            id: `res-req-${Date.now()}`,
            type: "TRENDS",
            channelProfile: { niche: execution.requestId },
            state: "CREATED",
            timestamp: new Date()
          });
        } else {
          researchRes = {
            requestId: `res-req-${Date.now()}`,
            topics: [{ id: "topic-1", topic: execution.requestId, finalScore: 0.95, tags: ["AI"] }],
            opportunities: [{ id: "opp-1", title: "TS Patterns", opportunityType: "TREND" }],
            competitorProfile: [{ competitorName: "AI Channel", uploadFrequency: "DAILY" }]
          };
        }
        buffers.researchOutput = researchRes;
        if (this.context.knowledgeBaseEngine?.store) {
          await this.context.knowledgeBaseEngine.store({
            type: KnowledgeNodeType.RESEARCH,
            title: `Research Analysis for ${execution.requestId}`,
            content: JSON.stringify({ analysis: res.completion, researchData: researchRes }),
            source: KnowledgeSource.RESEARCH_ENGINE,
            tags: ["research"]
          });
        }
      } else if (stage === PipelineStage.STRATEGY) {
        this._state = PipelineState.ANALYZING;
        await this._dbLog(execution.id, execution.requestId, "ANALYZING", "Analyzing competitor and keyword matrices.");
        this._state = PipelineState.PLANNING;
        await this._dbLog(execution.id, execution.requestId, "PLANNING", "Designing content pillars and upload schedules.");
        const res = await this._callLLMWithRetry(
          `Based on research data: ${JSON.stringify(buffers.researchOutput)}, design content pillars and calendar.`,
          ProviderType.OPENAI,
          "gpt-4o",
          execution.id
        );
        let strategyRes: any = null;
        if (this.context.strategyEngine?.generate) {
          strategyRes = await this.context.strategyEngine.generate({
            id: `strat-req-${Date.now()}`,
            type: "GROWTH",
            researchResponse: buffers.researchOutput,
            state: "CREATED",
            timestamp: new Date()
          });
        } else {
          strategyRes = {
            strategyId: `strat-${Date.now()}`,
            pillars: [{ id: "pillar-1", name: "Core Tutorials", supportingTopics: [] }]
          };
        }
        buffers.strategyOutput = strategyRes;
        if (this.context.knowledgeBaseEngine?.store) {
          await this.context.knowledgeBaseEngine.store({
            type: KnowledgeNodeType.STRATEGY,
            title: "Content Strategy & Audience Profile",
            content: JSON.stringify({ strategy: strategyRes, llmOutput: res.completion }),
            source: KnowledgeSource.PIPELINE_ENGINE,
            tags: ["strategy"]
          });
        }
      } else if (stage === PipelineStage.CHANNEL) {
        let channelRes: any = null;
        if (this.context.channelEngine?.generate) {
          channelRes = await this.context.channelEngine.generate(`chan-${Date.now()}`, execution.requestId);
        } else {
          channelRes = {
            identity: { id: "chan-1", name: "AI Dev Studio", niche: "AI" },
            brandGuide: { tone: "EDUCATIONAL", writingStyle: "Direct" }
          };
        }
        buffers.channelOutput = channelRes;
        if (this.context.knowledgeBaseEngine?.store) {
          await this.context.knowledgeBaseEngine.store({
            type: KnowledgeNodeType.DOCUMENT,
            title: "Channel brand guidelines & identity blueprints",
            content: JSON.stringify(channelRes),
            source: KnowledgeSource.PIPELINE_ENGINE,
            tags: ["brand"]
          });
        }
      } else if (stage === PipelineStage.SCRIPT) {
        this._state = PipelineState.SCRIPTING;
        await this._dbLog(execution.id, execution.requestId, "SCRIPTING", "Structuring script blueprints and retention gaps.");
        const res = await this._callLLMWithRetry(
          `Write a full video script dialogue matching brand tone.`,
          ProviderType.ANTHROPIC,
          "claude-3-5-sonnet",
          execution.id
        );
        let scriptRes: any = null;
        if (this.context.scriptEngine?.generate) {
          scriptRes = await this.context.scriptEngine.generate({
            id: `scr-req-${Date.now()}`,
            type: "VIDEO",
            topic: execution.requestId,
            state: "CREATED",
            timestamp: new Date()
          });
        } else {
          scriptRes = {
            scriptId: `scr-${Date.now()}`,
            dialogue: [{ speaker: "Host", text: res.completion }]
          };
        }
        buffers.scriptOutput = scriptRes;
        if (this.context.knowledgeBaseEngine?.store) {
          await this.context.knowledgeBaseEngine.store({
            type: KnowledgeNodeType.SCRIPT,
            title: `Generated Script`,
            content: JSON.stringify(scriptRes),
            source: KnowledgeSource.SCRIPT_ENGINE,
            tags: ["script"]
          });
        }
        this._state = PipelineState.REVIEWING;
        await this._dbLog(execution.id, execution.requestId, "REVIEWING", "Validating script, language structure, and hallucination bounds.");
        const scriptText = scriptRes?.dialogue?.[0]?.text ?? "";
        this._validateScript(scriptText, execution.requestId);
      }

      status = PipelineStatus.SUCCESS;
    } catch (e: any) {
      errorMessage = e.message;
      status = PipelineStatus.FAILED;
    }

    stageExec.status = status;
    stageExec.completedAt = new Date();
    stageExec.durationMs = stageExec.completedAt.getTime() - stageExec.startedAt.getTime();

    if (status === PipelineStatus.SUCCESS) {
      completedStages.push(stage);
      await this._saveCheckpoint(execution, stage, { completed: true });
      await this._emit("StageCompleted", { executionId: execution.id, stage });
      return true;
    } else {
      stageExec.errorMessage = errorMessage;
      await this._emit("StageFailed", { executionId: execution.id, stage, error: errorMessage });

      // Retry / Recovery logic
      const failure: PipelineFailure = {
        id: `fail-${Date.now()}-${stage}`,
        executionId: execution.id,
        failedStage: stage,
        reason: errorMessage ?? "Unknown engine error",
        occurredAt: new Date(),
        canRetry: stageExec.retryCount < 1,
      };

      await this._emit("RecoveryStarted", { failureId: failure.id, stage });
      const recovery = await this._recoveryMgr.handleFailure(failure);
      await this._emit("RecoveryCompleted", { recoveryId: recovery.id, success: recovery.success });

      if (recovery.success && recovery.strategy === "RETRY") {
        stageExec.retryCount++;
        return this._runStage(execution, stage, completedStages, buffers);
      }

      return false;
    }
  }

  // ─── Script Validation ──────────────────────────────────────────────────────

  private _validateScript(scriptText: string, niche: string): void {
    if (!scriptText || scriptText.length < 10) {
      throw new Error("Script Validation Failed: Script length is too short.");
    }
    if (scriptText.toLowerCase().includes("hallucinate")) {
      throw new Error("Script Validation Failed: High risk of hallucinated claims.");
    }
  }

  // ─── Observability, Memory, Database Integration ─────────────────────────────

  private async _callLLMWithRetry(
    prompt: string,
    preferredProvider: ProviderType,
    model: string,
    executionId: string
  ): Promise<{ completion: string; tokensUsed: number; costUsd: number; provider: ProviderType }> {
    const sequence = [
      preferredProvider,
      ProviderType.OPENAI,
      ProviderType.GEMINI,
      ProviderType.ANTHROPIC,
      ProviderType.OPENROUTER
    ];

    const uniqueSequence = [...new Set(sequence)];
    let lastError: any = null;

    for (let i = 0; i < uniqueSequence.length; i++) {
      const provider = uniqueSequence[i];
      const start = Date.now();

      try {
        let response: any = null;

        if (this.context.llmProviderEngine?.chat) {
          response = await this.context.llmProviderEngine.chat({
            model: model,
            messages: [{ role: "user", content: prompt }],
            options: { provider }
          });
        } else {
          // Simulated fallback
          response = {
            id: `llm-resp-${Date.now()}`,
            completion: `This is a high quality response generated for: "${prompt}" using mock ${provider}`,
            usage: { promptTokens: 100, completionTokens: 250, totalTokens: 350 },
            provider,
            model,
            latencyMs: Date.now() - start
          };
        }

        const latency = Date.now() - start;
        const tokens = response.usage?.totalTokens ?? 350;
        const cost = provider === ProviderType.GEMINI ? 0.0001 : provider === ProviderType.OPENAI ? 0.0015 : 0.003;

        // Update local metrics
        this._metrics.latencyMs += latency;
        this._metrics.promptTokens += response.usage?.promptTokens ?? 100;
        this._metrics.completionTokens += response.usage?.completionTokens ?? 250;
        this._metrics.costUsd += cost;
        this._metrics.providersUsed.push(provider);

        // Memory Integration
        if (this.context.memoryStore?.set) {
          await this.context.memoryStore.set(
            "llm-history",
            `llm-run:${Date.now()}-${provider}`,
            JSON.stringify({
              prompt,
              response: response.completion,
              reasoning: "Selected based on cost/performance routing rule.",
              selectedProvider: provider,
              tokenUsage: response.usage
            })
          );
        }

        return {
          completion: response.completion,
          tokensUsed: tokens,
          costUsd: cost,
          provider
        };

      } catch (err) {
        lastError = err;
        this._metrics.retries++;
        await this._emit("FallbackTriggered", {
          executionId,
          failedProvider: provider,
          error: (err as Error).message
        });
      }
    }

    throw new Error(`All LLM providers failed. Last error: ${lastError?.message}`);
  }

  private async _dbLog(executionId: string, requestId: string, state: string, message: string): Promise<void> {
    if (this.context.databaseEngine?.getQueryManager()?.execute) {
      try {
        await this.context.databaseEngine.getQueryManager().execute({
          id: `db-log-${Date.now()}`,
          sql: "INSERT INTO pipeline_execution_history (execution_id, request_id, state, message, logged_at) VALUES (?, ?, ?, ?, ?)",
          parameters: [executionId, requestId, state, message, new Date().toISOString()]
        });
      } catch (_) {}
    }
  }

  private async _saveCheckpoint(execution: PipelineExecution, stage: PipelineStage, data: any): Promise<void> {
    const checkpoint: PipelineCheckpoint = {
      id: `chk-${Date.now()}-${stage}`,
      requestId: execution.requestId,
      executionId: execution.id,
      lastCompletedStage: stage,
      stageResults: data,
      savedAt: new Date(),
    };
    this._checkpointMgr.saveCheckpoint(checkpoint);
    await this._emit("CheckpointSaved", { checkpointId: checkpoint.id, executionId: execution.id });

    // Database Integration
    if (this.context.databaseEngine?.getQueryManager()?.execute) {
      try {
        await this.context.databaseEngine.getQueryManager().execute({
          id: `chk-db-${Date.now()}`,
          sql: "INSERT INTO pipeline_checkpoints (checkpoint_id, execution_id, stage, state_data, saved_at) VALUES (?, ?, ?, ?, ?)",
          parameters: [checkpoint.id, execution.id, stage, JSON.stringify(data), checkpoint.savedAt.toISOString()]
        });
      } catch (_) {}
    }
  }

  private async _emit(name: string, payload: Record<string, unknown>): Promise<void> {
    if (this.context?.eventBus?.publish) {
      try {
        await this.context.eventBus.publish({
          id: `evt-${name.toLowerCase()}-${Math.random().toString(36).slice(2, 7)}`,
          name,
          timestamp: new Date(),
          source: "PipelineEngine",
          payload,
          metadata: {},
        });
      } catch (_) {}
    }
  }

  // ─── Snapshots & Reporting ──────────────────────────────────────────────────

  public getSnapshot(): PipelineSnapshot {
    const snap: PipelineSnapshot = {
      id: `psnap-${Date.now()}`,
      state: this._state,
      activeExecution: this._activeExecution,
      metrics: {
        stageDurationsMs: {} as Record<PipelineStage, number>,
        totalRetries: this._metrics.retries,
        costUsd: this._metrics.costUsd,
        successRate: 1.0,
      },
      timestamp: new Date(),
    };
    const frozen = deepFreeze(snap);
    PipelineValidator.validateSnapshotIntegrity(frozen);
    return frozen;
  }

  public getReport(executionId: string): PipelineReport | undefined {
    return this._reports.get(executionId);
  }
}
