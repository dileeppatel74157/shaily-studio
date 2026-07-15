import { IKernel } from "./IKernel";
import { KernelModule } from "./KernelModule";
import { KernelSnapshot } from "./KernelSnapshot";
import { KernelContext } from "./KernelContext";
import { KernelRegistry } from "./KernelRegistry";
import { KernelState } from "./KernelState";
import { DependencyResolver } from "./DependencyResolver";
import { DependencyGraph } from "./DependencyGraph";
import { KernelValidator } from "./KernelValidator";
import {
  KernelValidationException,
  InvalidKernelStateException,
  deepFreeze,
} from "./types";

export class Kernel implements IKernel {
  private readonly _context: KernelContext;
  private readonly _registry = new KernelRegistry();
  private readonly _metadata: Readonly<Record<string, unknown>>;
  private _state: KernelState = KernelState.CREATED;
  private _startupOrder: string[] = [];
  private _shutdownOrder: string[] = [];

  constructor(
    context: KernelContext,
    metadata?: Record<string, unknown>
  ) {
    KernelValidator.validateContext(context);
    this._context = context;
    this._metadata = metadata ? { ...metadata } : {};
  }

  public async initialize(): Promise<void> {
    if (this._state !== KernelState.CREATED) {
      throw new InvalidKernelStateException("initialize", this._state);
    }
    this._state = KernelState.INITIALIZING;
    try {
      const modules = this._registry.list();
      const { startupOrder, shutdownOrder } = DependencyResolver.resolve(modules);
      this._startupOrder = [...startupOrder];
      this._shutdownOrder = [...shutdownOrder];

      // Initialize in dependency order
      for (const id of this._startupOrder) {
        const mod = this._registry.get(id);
        if (mod) {
          await mod.initialize();
        }
      }
      this._state = KernelState.READY;
    } catch (err) {
      this._state = KernelState.FAILED;
      throw err;
    }
  }

  public async start(): Promise<void> {
    if (this._state !== KernelState.READY) {
      throw new InvalidKernelStateException("start", this._state);
    }
    try {
      // Start in dependency order
      for (const id of this._startupOrder) {
        const mod = this._registry.get(id);
        if (mod) {
          await mod.start();
        }
      }
      this._state = KernelState.RUNNING;
    } catch (err) {
      this._state = KernelState.FAILED;
      throw err;
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== KernelState.RUNNING) {
      throw new InvalidKernelStateException("stop", this._state);
    }
    try {
      // Stop in reverse dependency order
      for (const id of this._shutdownOrder) {
        const mod = this._registry.get(id);
        if (mod) {
          await mod.stop();
        }
      }
      this._state = KernelState.STOPPED;
    } catch (err) {
      this._state = KernelState.FAILED;
      throw err;
    }
  }

  public async register(module: KernelModule): Promise<void> {
    if (this._state !== KernelState.CREATED) {
      throw new InvalidKernelStateException("register", this._state);
    }
    KernelValidator.validateModule(module);
    this._registry.register(module);
  }

  public async unregister(moduleId: string): Promise<void> {
    if (this._state !== KernelState.CREATED) {
      throw new InvalidKernelStateException("unregister", this._state);
    }
    KernelValidator.validateIdentifier(moduleId, "Module ID");
    this._registry.unregister(moduleId);
  }

  public has(moduleId: string): boolean {
    return this._registry.has(moduleId);
  }

  public get(moduleId: string): KernelModule | undefined {
    return this._registry.get(moduleId);
  }

  public list(): readonly KernelModule[] {
    return this._registry.list();
  }

  public snapshot(): KernelSnapshot {
    if (this._state !== KernelState.RUNNING && this._state !== KernelState.STOPPED) {
      throw new InvalidKernelStateException("snapshot", this._state);
    }

    const modules = this._registry.list();
    const nodes = modules.map((m) => ({
      id: m.id,
      dependencies: [...m.dependencies],
    }));
    const graph = new DependencyGraph(nodes);

    const snapshotObj: KernelSnapshot = {
      timestamp: new Date(),
      state: this._state,
      modules,
      dependencyGraph: graph,
      startupOrder: [...this._startupOrder],
      shutdownOrder: [...this._shutdownOrder],
      metadata: { ...this._context.metadata, ...this._metadata },
    };

    return deepFreeze(snapshotObj);
  }
}
