import { IAgent } from "./IAgent";
import { AgentMetadata } from "./AgentMetadata";
import { AgentState } from "./AgentState";
import { AgentContext } from "./AgentContext";
import { AgentLifecycle } from "./AgentLifecycle";
import { AgentSnapshot } from "./AgentSnapshot";
import { InvalidAgentStateException } from "./types";

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

  public get version(): string {
    return this._metadata.version;
  }

  public get description(): string {
    return this._metadata.description;
  }

  public get state(): AgentState {
    return this._state;
  }

  public get capabilities(): ReadonlyArray<string> {
    return this._metadata.capabilities;
  }

  public get metadata(): Record<string, unknown> {
    return this._metadata.metadata;
  }

  public async initialize(): Promise<void> {
    if (this._state !== AgentState.CREATED) {
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

  public async execute(input?: unknown): Promise<unknown> {
    if (this._state !== AgentState.READY) {
      throw new InvalidAgentStateException(this.id, "execute", this._state);
    }

    this._state = AgentState.RUNNING;
    this.context.logger.info(`Executing agent task: ${this.name} (${this.id})`);

    try {
      const result = await this._lifecycle.execute(this.context, input);
      this._state = AgentState.COMPLETED;
      this.context.logger.info(`Agent execution COMPLETED: ${this.name} (${this.id})`);
      return result;
    } catch (err) {
      this._state = AgentState.FAILED;
      this.context.logger.error(
        `Agent execution FAILED: ${this.name} (${this.id})`,
        {},
        err instanceof Error ? err : undefined
      );
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
    return Object.freeze({
      id: this.id,
      name: this.name,
      version: this.version,
      description: this.description,
      state: this._state,
      capabilities: Object.freeze([...this.capabilities]),
      metadata: Object.freeze(JSON.parse(JSON.stringify(this.metadata))),
      timestamp: new Date(),
    });
  }
}
