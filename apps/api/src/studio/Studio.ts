import { StudioState } from "./StudioState";
import { StudioMetadata } from "./StudioMetadata";
import { StudioContext } from "./StudioContext";
import { StudioSnapshot } from "./StudioSnapshot";
import { StudioLifecycle } from "./StudioLifecycle";
import { InvalidStudioStateException } from "./types";

export class Studio implements StudioLifecycle {
  private _state: StudioState = StudioState.CREATED;
  private _startTime: Date | null = null;

  private readonly _context: StudioContext;

  constructor(
    private readonly _metadata: StudioMetadata,
    context: StudioContext
  ) {
    this._context = context;
    Object.freeze(this._context);
  }

  public get context(): StudioContext {
    return this._context;
  }

  public get id(): string {
    return this._metadata.id;
  }

  public get version(): string {
    return this._metadata.version;
  }

  public get environment(): string {
    return this._metadata.environment;
  }

  public get state(): StudioState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state !== StudioState.CREATED) {
      throw new InvalidStudioStateException("initialize", this._state);
    }

    this._state = StudioState.INITIALIZING;
    this.context.logger.info(`Initializing Studio application runtime [${this.environment}]...`);

    try {
      // Boot Order / Lifecycle init:
      // Only the Kernel among the composed modules requires initialization.
      await this.context.kernel.initialize();

      this._state = StudioState.READY;
      this.context.logger.info(`Studio application runtime READY.`);
    } catch (err: any) {
      this._state = StudioState.FAILED;
      this.context.logger.error(`Studio initialization failed: ${err.message}`, {}, err);
      throw err;
    }
  }

  public async start(): Promise<void> {
    if (this._state !== StudioState.READY) {
      throw new InvalidStudioStateException("start", this._state);
    }

    this.context.logger.info(`Starting Studio application services...`);
    try {
      // Boot Order:
      // 5. Job Engine
      await this.context.jobs.start();

      // 9. Kernel
      await this.context.kernel.start();

      this._startTime = new Date();
      this._state = StudioState.RUNNING;
      this.context.logger.info(`Studio application runtime is RUNNING.`);
    } catch (err: any) {
      this._state = StudioState.FAILED;
      this.context.logger.error(`Studio startup failed: ${err.message}`, {}, err);
      throw err;
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== StudioState.RUNNING) {
      throw new InvalidStudioStateException("stop", this._state);
    }

    this._state = StudioState.STOPPING;
    this.context.logger.info(`Stopping Studio application services...`);

    try {
      // Shutdown Order (reverse of startup):
      // 9. Kernel
      await this.context.kernel.stop();

      // 5. Job Engine
      await this.context.jobs.stop();

      this._startTime = null;
      this._state = StudioState.STOPPED;
      this.context.logger.info(`Studio application runtime STOPPED.`);
    } catch (err: any) {
      this._state = StudioState.FAILED;
      this.context.logger.error(`Studio shutdown failed: ${err.message}`, {}, err);
      throw err;
    }
  }

  public snapshot(): StudioSnapshot {
    const uptime = this._startTime
      ? Math.floor((Date.now() - this._startTime.getTime()) / 1000)
      : 0;

    return Object.freeze({
      id: this.id,
      version: this.version,
      environment: this.environment,
      state: this._state,
      startTime: this._startTime ? new Date(this._startTime.getTime()) : null,
      uptime,
      registeredServicesCount: this.context.registry.snapshot().registrations.length,
    });
  }
}
