import { IExecutionSupervisor } from "./IExecutionSupervisor";
import { ExecutionSession } from "./ExecutionSession";
import { ExecutionCheckpoint } from "./ExecutionCheckpoint";
import { ExecutionSnapshot } from "./ExecutionSnapshot";
import { ExecutionReport } from "./ExecutionReport";
import { ExecutionState } from "./ExecutionState";
import { ExecutionGuard } from "./ExecutionGuard";
import { ExecutionValidator } from "./ExecutionValidator";
import { ExecutionIncident } from "./ExecutionIncident";
import { ExecutionFailure } from "./ExecutionFailure";
import { ExecutionRecovery } from "./ExecutionRecovery";
import { LimitExceededException, BudgetExceededException, deepFreeze } from "./types";

export class ExecutionSupervisor implements IExecutionSupervisor {
  private readonly _sessions = new Map<string, ExecutionSession>();
  private readonly _incidents: ExecutionIncident[] = [];

  constructor(public readonly context: any) {}

  public async registerSession(session: ExecutionSession): Promise<void> {
    ExecutionValidator.validatePolicy(session.policy);
    const newSession = {
      ...session,
      state: ExecutionState.READY,
    };
    this._sessions.set(session.id, newSession);

    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "ExecutionStarted",
        timestamp: new Date(),
        correlationId: "corr-sup",
        source: "ExecutionSupervisor",
        payload: { sessionId: session.id, type: session.type },
        metadata: {},
      });
    }
  }

  public async updateSessionState(sessionId: string, state: ExecutionState): Promise<void> {
    const session = this._sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    ExecutionValidator.validateTransition(session.state, state);

    const updated = {
      ...session,
      state,
      metrics: {
        ...session.metrics,
        endTime: state === ExecutionState.COMPLETED || state === ExecutionState.FAILED || state === ExecutionState.TIMEOUT || state === ExecutionState.CANCELLED ? new Date() : session.metrics.endTime,
      },
    };
    this._sessions.set(sessionId, updated);

    if (this.context.eventBus) {
      let name = "ExecutionStatusChanged";
      if (state === ExecutionState.PAUSED) name = "ExecutionPaused";
      else if (state === ExecutionState.COMPLETED) name = "ExecutionCompleted";
      else if (state === ExecutionState.FAILED) name = "ExecutionFailed";
      else if (state === ExecutionState.CANCELLED) name = "ExecutionCancelled";

      await this.context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name,
        timestamp: new Date(),
        correlationId: "corr-sup",
        source: "ExecutionSupervisor",
        payload: { sessionId, state },
        metadata: {},
      });
    }
  }

  public async createCheckpoint(
    sessionId: string,
    variables: Record<string, unknown>,
    progress: number
  ): Promise<ExecutionCheckpoint> {
    const session = this._sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const checkpoint: ExecutionCheckpoint = {
      id: "chk-" + Math.random().toString(36).substring(2, 11),
      sessionId,
      timestamp: new Date(),
      variables,
      progress,
    };

    ExecutionValidator.validateCheckpoint(checkpoint);

    const updated = {
      ...session,
      checkpoints: [...session.checkpoints, checkpoint],
    };
    this._sessions.set(sessionId, updated);

    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "ExecutionCheckpointCreated",
        timestamp: new Date(),
        correlationId: "corr-sup",
        source: "ExecutionSupervisor",
        payload: { sessionId, checkpointId: checkpoint.id, progress },
        metadata: {},
      });
    }

    return checkpoint;
  }

  public async restoreCheckpoint(sessionId: string, checkpointId: string): Promise<ExecutionCheckpoint> {
    const session = this._sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const chk = session.checkpoints.find((c) => c.id === checkpointId);
    if (!chk) throw new Error(`Checkpoint ${checkpointId} not found in session ${sessionId}`);

    return chk;
  }

  public async consumeBudget(sessionId: string, tokens: number, cost: number, apiCalls = 1): Promise<void> {
    const session = this._sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const updatedMetrics = {
      ...session.metrics,
      totalTokens: session.metrics.totalTokens + tokens,
      totalCost: session.metrics.totalCost + cost,
      aiCallsCount: session.metrics.aiCallsCount + (session.type === "ai" ? apiCalls : 0),
      toolCallsCount: session.metrics.toolCallsCount + (session.type === "tool" ? apiCalls : 0),
      recursionDepth: session.metrics.recursionDepth + (session.type === "workflow" ? 1 : 0),
    };

    const updated = {
      ...session,
      metrics: updatedMetrics,
    };
    this._sessions.set(sessionId, updated);

    try {
      ExecutionGuard.checkLimits(updated);
      ExecutionGuard.checkBudget(updated);
    } catch (err) {
      let type: "limit_exceeded" | "budget_exceeded" = "limit_exceeded";
      let severity: "warning" | "error" | "critical" = "error";
      let eventName = "ExecutionLimitExceeded";

      if (err instanceof BudgetExceededException) {
        type = "budget_exceeded";
        severity = "critical";
        eventName = "ExecutionBudgetExceeded";
      }

      const incident: ExecutionIncident = {
        id: "inc-" + Math.random().toString(36).substring(2, 11),
        sessionId,
        type,
        details: err instanceof Error ? err.message : String(err),
        severity,
        timestamp: new Date(),
      };
      this._incidents.push(incident);

      const updatedSessionWithIncident = {
        ...updated,
        state: ExecutionState.FAILED,
        incidents: [...updated.incidents, incident],
      };
      this._sessions.set(sessionId, updatedSessionWithIncident);

      if (this.context.eventBus) {
        await this.context.eventBus.publish({
          id: "evt-" + Math.random().toString(36).substring(2, 11),
          name: eventName,
          timestamp: new Date(),
          correlationId: "corr-sup",
          source: "ExecutionSupervisor",
          payload: { sessionId, details: incident.details },
          metadata: {},
        });
      }

      throw err;
    }
  }

  public async recordFailure(sessionId: string, error: Error): Promise<void> {
    const session = this._sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const failure: ExecutionFailure = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date(),
    };

    const updated = {
      ...session,
      failures: [...session.failures, failure],
      state: ExecutionState.FAILED,
    };
    this._sessions.set(sessionId, updated);

    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "ExecutionFailed",
        timestamp: new Date(),
        correlationId: "corr-sup",
        source: "ExecutionSupervisor",
        payload: { sessionId, error: error.message },
        metadata: {},
      });
    }
  }

  public async executeRecovery(sessionId: string): Promise<boolean> {
    const session = this._sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    // Pick recovery from allowedRecoveries
    const allowed = session.policy.allowedRecoveries;
    if (allowed.length === 0) return false;

    // Simulate recovery based on allowed list
    const strategy = allowed[0];
    const recId = "rec-" + Math.random().toString(36).substring(2, 11);

    let success = false;
    let checkpointId: string | undefined;

    if (strategy === "retry") {
      if (session.metrics.retriesCount < session.policy.limits.maxRetries) {
        success = true;
      }
    } else if (strategy === "rollback") {
      if (session.checkpoints.length > 0) {
        checkpointId = session.checkpoints[session.checkpoints.length - 1].id;
        success = true;
      }
    } else if (strategy === "resume") {
      if (session.checkpoints.length > 0) {
        checkpointId = session.checkpoints[0].id;
        success = true;
      }
    } else if (strategy === "restart") {
      success = true;
    }

    const recoveryRecord: ExecutionRecovery = {
      id: recId,
      sessionId,
      strategy,
      error: session.failures[session.failures.length - 1]?.message || "Unknown error",
      checkpointId,
      timestamp: new Date(),
      success,
    };

    const updatedMetrics = {
      ...session.metrics,
      retriesCount: session.metrics.retriesCount + (strategy === "retry" ? 1 : 0),
    };

    const updated = {
      ...session,
      metrics: updatedMetrics,
      state: success ? ExecutionState.RUNNING : ExecutionState.FAILED,
      recoveryHistory: [...session.recoveryHistory, recoveryRecord],
    };
    this._sessions.set(sessionId, updated);

    if (success && this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "ExecutionRecovered",
        timestamp: new Date(),
        correlationId: "corr-sup",
        source: "ExecutionSupervisor",
        payload: { sessionId, strategy, checkpointId },
        metadata: {},
      });
    }

    return success;
  }

  public async getReport(): Promise<ExecutionReport> {
    const list = Array.from(this._sessions.values());
    const active = list.filter((s) => s.state === ExecutionState.RUNNING).length;
    const completed = list.filter((s) => s.state === ExecutionState.COMPLETED).length;
    const failed = list.filter((s) => s.state === ExecutionState.FAILED).length;

    let totalTokens = 0;
    let totalCost = 0;
    for (const s of list) {
      totalTokens += s.metrics.totalTokens;
      totalCost += s.metrics.totalCost;
    }

    return {
      timestamp: new Date(),
      activeSessionsCount: active,
      completedSessionsCount: completed,
      failedSessionsCount: failed,
      incidentCount: this._incidents.length,
      averageLatencyMs: 250, // default latency health
      totalTokensConsumed: totalTokens,
      totalCostConsumed: totalCost,
      health: {
        latencyMs: 250,
        failuresCount: failed,
        retryCount: list.reduce((acc, s) => acc + s.metrics.retriesCount, 0),
        memoryUsageBytes: 45 * 1024 * 1024,
        queueLength: active,
        providerFailuresCount: 0,
        toolFailuresCount: 0,
      },
    };
  }

  public snapshot(): ReadonlyArray<ExecutionSnapshot> {
    const list = Array.from(this._sessions.values()).map((s) => ({
      sessionId: s.id,
      type: s.type,
      state: s.state,
      checkpoints: s.checkpoints,
      budget: s.policy.budget,
      limits: s.policy.limits,
      health: {
        latencyMs: 250,
        failuresCount: s.failures.length,
        retryCount: s.metrics.retriesCount,
        memoryUsageBytes: 45 * 1024 * 1024,
        queueLength: s.state === ExecutionState.RUNNING ? 1 : 0,
        providerFailuresCount: 0,
        toolFailuresCount: 0,
      },
      failures: s.failures,
      recoveryHistory: s.recoveryHistory,
      timestamp: new Date(),
    }));

    return deepFreeze(list);
  }
}
