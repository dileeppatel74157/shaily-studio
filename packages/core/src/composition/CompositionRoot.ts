import { IServiceProvider } from "./IServiceProvider";
import { CompositionContext } from "./CompositionContext";
import { CompositionSnapshot } from "./CompositionSnapshot";
import { IStudio } from "../studio/IStudio";
import {
  InvalidCompositionStateException,
  deepFreeze,
} from "./types";

export class CompositionRoot {
  private _state: "CREATED" | "READY" | "RUNNING" | "STOPPED" = "CREATED";
  private readonly _context: CompositionContext;
  private readonly _metadata: Record<string, unknown>;
  private readonly _provider: IServiceProvider;
  private _studio?: IStudio;

  constructor(
    context: CompositionContext,
    metadata: Record<string, unknown>,
    provider: IServiceProvider
  ) {
    this._context = context;
    this._metadata = metadata;
    this._provider = provider;
  }

  public get state(): "CREATED" | "READY" | "RUNNING" | "STOPPED" {
    return this._state;
  }

  public get context(): CompositionContext {
    return this._context;
  }

  public get metadata(): Readonly<Record<string, unknown>> {
    return this._metadata;
  }

  public get provider(): IServiceProvider {
    return this._provider;
  }

  public async initialize(): Promise<void> {
    if (this._state !== "CREATED") {
      throw new InvalidCompositionStateException("initialize", this._state);
    }

    this._studio = this._provider.resolve<IStudio>("IStudio");
    await this._studio.initialize();
    
    this._state = "READY";
  }

  public async start(): Promise<void> {
    if (this._state !== "READY") {
      throw new InvalidCompositionStateException("start", this._state);
    }

    if (!this._studio) {
      this._studio = this._provider.resolve<IStudio>("IStudio");
    }
    await this._studio.start();

    this._state = "RUNNING";
  }

  public async stop(): Promise<void> {
    if (this._state !== "RUNNING") {
      throw new InvalidCompositionStateException("stop", this._state);
    }

    if (this._studio) {
      await this._studio.stop();
    }

    this._state = "STOPPED";
  }

  public snapshot(): CompositionSnapshot {
    const providerSnapshot = this._provider.snapshot();
    const snap: CompositionSnapshot = {
      timestamp: new Date(),
      services: providerSnapshot.services,
      singletonCount: providerSnapshot.singletonCount,
      scopedCount: providerSnapshot.scopedCount,
      transientCount: providerSnapshot.transientCount,
      dependencyGraph: providerSnapshot.dependencyGraph,
      metadata: {
        ...this._metadata,
        state: this._state,
        context: this._context,
      },
    };
    return deepFreeze(snap);
  }
}
