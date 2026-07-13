import { IOrchestrator } from "./IOrchestrator";
import { OrchestratorRequest } from "./OrchestratorRequest";
import { OrchestratorResponse } from "./OrchestratorResponse";
import { OrchestratorSnapshot } from "./OrchestratorSnapshot";
import { OrchestratorState } from "./OrchestratorState";
import { OrchestratorContext } from "./OrchestratorContext";
import { ExecutionValidator } from "./ExecutionValidator";
import { InvalidOrchestratorStateException } from "./types";
import { EventBuilder } from "../events/EventBuilder";
import { JobBuilder } from "../jobs/JobBuilder";
import { JobPriority } from "../jobs/JobPriority";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class Orchestrator implements IOrchestrator {
  private _state: OrchestratorState = OrchestratorState.CREATED;
  private _activeExecutions = 0;
  private _totalExecutions = 0;
  private readonly _validator = new ExecutionValidator();

  constructor(public readonly context: OrchestratorContext) {}

  public get state(): OrchestratorState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state !== OrchestratorState.CREATED) {
      throw new InvalidOrchestratorStateException("initialize", this._state);
    }
    this._state = OrchestratorState.READY;
    this.context.logger.info("AI Orchestrator initialized.");
  }

  public async start(): Promise<void> {
    if (this._state !== OrchestratorState.READY) {
      throw new InvalidOrchestratorStateException("start", this._state);
    }
    this._state = OrchestratorState.RUNNING;
    this.context.logger.info("AI Orchestrator started.");
  }

  public async stop(): Promise<void> {
    if (this._state !== OrchestratorState.RUNNING) {
      throw new InvalidOrchestratorStateException("stop", this._state);
    }
    this._state = OrchestratorState.STOPPED;
    this.context.logger.info("AI Orchestrator stopped.");
  }

  public async execute(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    if (this._state !== OrchestratorState.RUNNING) {
      throw new InvalidOrchestratorStateException("execute", this._state);
    }

    this._validator.validateRequest(request);
    this._activeExecutions++;
    this._totalExecutions++;

    const executionId = generateUUID();
    const startTime = Date.now();
    this.context.logger.info(`Starting execution ${executionId} for task: ${request.taskName}`);

    // Publish ExecutionStarted event
    await this.context.eventBus.publish(
      new EventBuilder()
        .withName("orchestrator.execution.started")
        .withPayload({
          requestId: request.requestId,
          executionId,
          taskName: request.taskName,
        })
        .build()
    );

    let output: unknown;
    let success = false;
    const errors: string[] = [];

    try {
      const isLongRunning = request.metadata?.longRunning === true;

      if (isLongRunning) {
        // Run via Job Engine
        output = await this.executeAsJob(request, executionId);
      } else {
        // Run directly
        output = await this.executeDirectly(request);
      }

      success = true;

      // Publish ExecutionCompleted event
      await this.context.eventBus.publish(
        new EventBuilder()
          .withName("orchestrator.execution.completed")
          .withPayload({
            requestId: request.requestId,
            executionId,
            taskName: request.taskName,
          })
          .build()
      );
    } catch (err: any) {
      success = false;
      const errMsg = err.message || String(err);
      errors.push(errMsg);

      // Publish ExecutionFailed event
      await this.context.eventBus.publish(
        new EventBuilder()
          .withName("orchestrator.execution.failed")
          .withPayload({
            requestId: request.requestId,
            executionId,
            error: errMsg,
          })
          .build()
      );
    } finally {
      this._activeExecutions--;
      const duration = Date.now() - startTime;

      // Record metadata in Memory Store (No prompts or outputs stored permanently)
      try {
        await this.context.memoryStore.set("orchestrator", `execution:${executionId}`, {
          requestId: request.requestId,
          executionId,
          taskName: request.taskName,
          success,
          duration,
          timestamp: new Date().toISOString(),
        });
      } catch (memErr) {
        this.context.logger.warn(
          "Failed to write execution metadata to Memory Store",
          {},
          memErr as Error
        );
      }

      this.context.logger.info(
        `Execution ${executionId} finished. Success: ${success}. Duration: ${duration}ms`
      );
    }

    return {
      requestId: request.requestId,
      success,
      executionId,
      duration: Date.now() - startTime,
      output,
      errors: errors.length > 0 ? errors : undefined,
      metadata: request.metadata,
    };
  }

  private async executeDirectly(request: OrchestratorRequest): Promise<unknown> {
    if (request.agentId) {
      // 1. Execute Agent
      const agent = this.context.agentRegistry.get(request.agentId);
      if (!agent) {
        throw new Error(`Agent with ID ${request.agentId} not found in agent registry.`);
      }
      if (agent.state === "CREATED") {
        await agent.initialize();
      }
      return await agent.execute(request.input);
    } else if (request.workflowId) {
      // 2. Execute Workflow
      const workflow = this.context.workflowEngine.get(request.workflowId);
      if (!workflow) {
        throw new Error(`Workflow with ID ${request.workflowId} not found in workflow engine.`);
      }
      return await this.context.workflowEngine.execute(request.workflowId);
    } else {
      // 3. Route Prompt through LLM Router
      const prompt =
        typeof request.input === "string" ? request.input : JSON.stringify(request.input);
      const routeRes = await this.context.llmRouter.route({
        prompt,
      });
      return routeRes.providerResponse.text;
    }
  }

  private async executeAsJob(request: OrchestratorRequest, executionId: string): Promise<unknown> {
    const job = new JobBuilder()
      .withId(executionId)
      .withName(`orchestrator-job-${request.taskName}`)
      .withPriority(JobPriority.NORMAL)
      .withExecution(async () => {
        return await this.executeDirectly(request);
      })
      .build();

    // Submit job
    await this.context.jobEngine.submit(job);

    // Wait for job completion or failure
    return new Promise((resolve, reject) => {
      let resolved = false;

      const checkStatus = setInterval(() => {
        const currentJob = this.context.jobEngine.get(executionId);
        if (!currentJob) return;

        const snap = currentJob.toSnapshot();
        if (snap.status === "COMPLETED") {
          clearInterval(checkStatus);
          if (!resolved) {
            resolved = true;
            resolve(snap.result);
          }
        } else if (snap.status === "FAILED") {
          clearInterval(checkStatus);
          if (!resolved) {
            resolved = true;
            reject(new Error(snap.error || "Job execution failed."));
          }
        }
      }, 50);

      // Timeout safety (e.g. 30 seconds)
      setTimeout(() => {
        clearInterval(checkStatus);
        if (!resolved) {
          resolved = true;
          reject(new Error("Job execution timed out."));
        }
      }, 30000);
    });
  }

  public snapshot(): OrchestratorSnapshot {
    return Object.freeze({
      timestamp: new Date(),
      state: this._state,
      activeExecutionsCount: this._activeExecutions,
      totalExecutionsProcessed: this._totalExecutions,
    });
  }
}
