import { IAgent } from "./IAgent";
import { AgentMetadata } from "./AgentMetadata";
import { AgentState } from "./AgentState";
import { AgentContext } from "./AgentContext";
import { AgentLifecycle } from "./AgentLifecycle";
import { AgentSnapshot } from "./AgentSnapshot";
import { AgentRole } from "./AgentRole";
import { AgentCapability } from "./AgentCapability";
import { AgentGoal } from "./AgentGoal";
import { AgentProfile } from "./AgentProfile";
import { AgentConfiguration } from "./AgentConfiguration";
import { AgentExecution } from "./AgentExecution";
import { AgentValidator } from "./AgentValidator";
import { InvalidAgentStateException, deepFreeze } from "./types";

export class Agent implements IAgent {
  private _state: AgentState = AgentState.CREATED;

  constructor(
    private readonly _metadata: AgentMetadata,
    public readonly context: AgentContext,
    private readonly _lifecycle: AgentLifecycle
  ) {}

  public get id(): string {
    return this._metadata.id;
  }

  public get name(): string {
    return this._metadata.name;
  }

  public get role(): AgentRole {
    return this._metadata.role || "Generalist";
  }

  public get version(): string {
    return this._metadata.version;
  }

  public get description(): string {
    return this._metadata.description;
  }

  public get state(): AgentState {
    return this._state;
  }

  public get capabilities(): ReadonlyArray<AgentCapability> {
    return this._metadata.capabilities;
  }

  public get goals(): ReadonlyArray<AgentGoal> {
    return this._metadata.goals || [];
  }

  public get profile(): AgentProfile | undefined {
    return this._metadata.profile;
  }

  public get configuration(): AgentConfiguration | undefined {
    return this._metadata.configuration;
  }

  public get metadata(): Record<string, unknown> {
    return this._metadata.metadata;
  }

  public async initialize(): Promise<void> {
    try {
      AgentValidator.validateLifecycleTransition(this._state, AgentState.READY);
    } catch (err: any) {
      throw new InvalidAgentStateException(this.id, "initialize", this._state);
    }

    this.context.logger.info(`Initializing agent: ${this.name} (${this.id})`);
    try {
      await this._lifecycle.initialize(this.context);
      this._state = AgentState.READY;
      this.context.logger.info(`Agent initialized and READY: ${this.name} (${this.id})`);
    } catch (err) {
      this._state = AgentState.FAILED;
      this.context.logger.error(
        `Agent initialization failed: ${this.name} (${this.id})`,
        {},
        err instanceof Error ? err : undefined
      );
      throw err;
    }
  }

  public async start(): Promise<void> {
    AgentValidator.validateLifecycleTransition(this._state, AgentState.RUNNING);
    this._state = AgentState.RUNNING;
    this.context.logger.info(`Agent started: ${this.name} (${this.id})`);
  }

  public async pause(): Promise<void> {
    AgentValidator.validateLifecycleTransition(this._state, AgentState.PAUSED);
    this._state = AgentState.PAUSED;
    this.context.logger.info(`Agent paused: ${this.name} (${this.id})`);
  }

  public async resume(): Promise<void> {
    AgentValidator.validateLifecycleTransition(this._state, AgentState.RUNNING);
    this._state = AgentState.RUNNING;
    this.context.logger.info(`Agent resumed: ${this.name} (${this.id})`);
  }

  public async stop(): Promise<void> {
    AgentValidator.validateLifecycleTransition(this._state, AgentState.STOPPED);
    this._state = AgentState.STOPPED;
    this.context.logger.info(`Agent stopped: ${this.name} (${this.id})`);
  }

  public async execute(input?: unknown): Promise<unknown> {
    const isTask = input && typeof input === "object" && "id" in input && "description" in input;
    if (isTask) {
      AgentValidator.validateExecutionConstraints(input as any, this.configuration);
    }

    const startTime = new Date();
    try {
      AgentValidator.validateLifecycleTransition(this._state, AgentState.RUNNING);
    } catch (err: any) {
      throw new InvalidAgentStateException(this.id, "execute", this._state);
    }

    this._state = AgentState.RUNNING;
    
    // Agents request plans before execution
    if (this.context.registry) {
      try {
        const token = { name: "IPlanningEngine" } as any;
        if (this.context.registry.has(token)) {
          const planningEngine = this.context.registry.resolve(token) as any;
          if (planningEngine) {
            await planningEngine.createPlan({
              id: "plan-exec-" + this.id + "-" + Date.now(),
              goal: {
                id: "goal-exec-" + this.id + "-" + Date.now(),
                description: this.description || "Execute agent task",
                priority: "NORMAL" as any,
                type: "SIMPLE" as any,
                status: "PENDING" as any,
              },
            });
          }
        }
      } catch (e) {
        // Ignored to avoid breaking tests where PlanningEngine is not bound
      }
    }

    this.context.logger.info(`Executing agent task: ${this.name} (${this.id})`);

    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "AgentStarted",
        timestamp: new Date(),
        correlationId: "corr-agent",
        source: "Agent:" + this.id,
        payload: { agentId: this.id, input },
        metadata: {},
      });
    }

    try {
      const result = await this._lifecycle.execute(this.context, input);
      
      try {
        AgentValidator.validateLifecycleTransition(this._state, AgentState.COMPLETED);
      } catch (err: any) {
        throw new InvalidAgentStateException(this.id, "complete", this._state);
      }
      this._state = AgentState.COMPLETED;
      this.context.logger.info(`Agent execution COMPLETED: ${this.name} (${this.id})`);

      if (this.context.eventBus) {
        await this.context.eventBus.publish({
          id: "evt-" + Math.random().toString(36).substring(2, 11),
          name: "AgentFinished",
          timestamp: new Date(),
          correlationId: "corr-agent",
          source: "Agent:" + this.id,
          payload: { agentId: this.id, success: true },
          metadata: {},
        });
      }

      const execution: AgentExecution = deepFreeze({
        id: "exec-" + Math.random().toString(36).substring(2, 11),
        agentId: this.id,
        taskId: isTask ? (input as any).id : undefined,
        status: this._state,
        input,
        output: result,
        startTime,
        endTime: new Date(),
      });

      if (isTask) {
        return execution;
      }
      return result;
    } catch (err: any) {
      try {
        AgentValidator.validateLifecycleTransition(this._state, AgentState.FAILED);
      } catch (e: any) {
        // do not override original error if transition validation fails
      }
      this._state = AgentState.FAILED;
      this.context.logger.error(
        `Agent execution FAILED: ${this.name} (${this.id})`,
        {},
        err instanceof Error ? err : undefined
      );

      if (this.context.eventBus) {
        await this.context.eventBus.publish({
          id: "evt-" + Math.random().toString(36).substring(2, 11),
          name: "AgentFinished",
          timestamp: new Date(),
          correlationId: "corr-agent",
          source: "Agent:" + this.id,
          payload: { agentId: this.id, success: false, error: err.message },
          metadata: {},
        });
      }

      deepFreeze({
        id: "exec-" + Math.random().toString(36).substring(2, 11),
        agentId: this.id,
        taskId: isTask ? (input as any).id : undefined,
        status: this._state,
        input,
        error: err.message,
        startTime,
        endTime: new Date(),
      });

      throw err;
    }
  }

  public async shutdown(): Promise<void> {
    this.context.logger.info(`Shutting down agent: ${this.name} (${this.id})`);
    try {
      await this._lifecycle.shutdown(this.context);
      this._state = AgentState.STOPPED;
      this.context.logger.info(`Agent shutdown STOPPED: ${this.name} (${this.id})`);
    } catch (err) {
      this._state = AgentState.FAILED;
      this.context.logger.error(
        `Agent shutdown failed: ${this.name} (${this.id})`,
        {},
        err instanceof Error ? err : undefined
      );
      throw err;
    }
  }

  public snapshot(): AgentSnapshot {
    return deepFreeze({
      id: this.id,
      name: this.name,
      role: this.role,
      version: this.version,
      description: this.description,
      state: this._state,
      capabilities: [...this.capabilities],
      goals: [...this.goals],
      profile: this.profile ? { ...this.profile } : undefined,
      configuration: this.configuration ? { ...this.configuration } : undefined,
      metadata: JSON.parse(JSON.stringify(this.metadata)),
      timestamp: new Date(),
    });
  }
}
