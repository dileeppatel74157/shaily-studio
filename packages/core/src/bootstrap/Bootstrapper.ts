import { IBootstrapper } from "./IBootstrapper";
import { BootstrapManifest } from "./BootstrapManifest";
import { BootstrapSnapshot } from "./BootstrapSnapshot";
import { BootstrapContext } from "./BootstrapContext";
import { BootstrapState } from "./BootstrapState";
import { BootstrapValidator } from "./BootstrapValidator";
import { DependencyScanner } from "./DependencyScanner";
import { ModuleLoader } from "./ModuleLoader";
import { KernelBuilder } from "../kernel/KernelBuilder";
import { IKernel } from "../kernel/IKernel";
import {
  BootstrapValidationException,
  InvalidBootstrapStateException,
  deepFreeze,
} from "./types";

export class Bootstrapper implements IBootstrapper {
  private readonly _context: BootstrapContext;
  private readonly _loader: ModuleLoader;
  private readonly _metadata: Readonly<Record<string, unknown>>;
  private _state: BootstrapState = BootstrapState.CREATED;
  private _manifest?: BootstrapManifest;
  private _kernel?: IKernel;
  private readonly _steps: string[] = [];

  constructor(
    context: BootstrapContext,
    loader: ModuleLoader,
    metadata?: Record<string, unknown>
  ) {
    BootstrapValidator.validateContext(context);
    if (!loader) {
      throw new BootstrapValidationException("ModuleLoader is required");
    }
    this._context = context;
    this._loader = loader;
    this._metadata = metadata ? { ...metadata } : {};
  }

  public async initialize(): Promise<void> {
    if (this._state !== BootstrapState.CREATED) {
      throw new InvalidBootstrapStateException("initialize", this._state);
    }
    try {
      this._state = BootstrapState.READY;
    } catch (err) {
      this._state = BootstrapState.FAILED;
      throw err;
    }
  }

  public async loadManifest(manifest: BootstrapManifest): Promise<void> {
    if (this._state !== BootstrapState.CREATED && this._state !== BootstrapState.READY) {
      throw new InvalidBootstrapStateException("loadManifest", this._state);
    }
    BootstrapValidator.validateManifest(manifest);
    
    // Deep clone and freeze
    const manifestCopy = JSON.parse(JSON.stringify(manifest));
    this._manifest = deepFreeze(manifestCopy);
    this._state = BootstrapState.READY;
  }

  public manifest(): BootstrapManifest {
    if (!this._manifest) {
      throw new BootstrapValidationException("No manifest has been loaded");
    }
    return this._manifest;
  }

  public async bootstrap(): Promise<void> {
    if (this._state !== BootstrapState.READY) {
      throw new InvalidBootstrapStateException("bootstrap", this._state);
    }
    if (!this._manifest) {
      throw new BootstrapValidationException("Cannot bootstrap without a loaded manifest");
    }

    this._state = BootstrapState.BOOTSTRAPPING;
    try {
      const order = DependencyScanner.scan(this._manifest);

      const kContext = {
        env: this._context.env,
        namespace: this._context.namespace,
        metadata: { ...this._context.metadata },
      };
      
      const kBuilder = new KernelBuilder().withContext(kContext);
      this._kernel = kBuilder.build();

      for (const id of order) {
        const mod = this._loader.load(id, this._manifest);
        await this._kernel.register(mod);
        this._steps.push(id);
      }

      await this._kernel.initialize();
      await this._kernel.start();

      this._state = BootstrapState.RUNNING;
    } catch (err) {
      this._state = BootstrapState.FAILED;
      throw err;
    }
  }

  public async shutdown(): Promise<void> {
    if (this._state !== BootstrapState.RUNNING) {
      throw new InvalidBootstrapStateException("shutdown", this._state);
    }
    try {
      if (this._kernel) {
        await this._kernel.stop();
      }
      this._state = BootstrapState.STOPPED;
    } catch (err) {
      this._state = BootstrapState.FAILED;
      throw err;
    }
  }

  public snapshot(): BootstrapSnapshot {
    if (this._state !== BootstrapState.RUNNING && this._state !== BootstrapState.STOPPED) {
      throw new InvalidBootstrapStateException("snapshot", this._state);
    }

    if (!this._manifest) {
      throw new BootstrapValidationException("Manifest not set");
    }

    const snapshotObj: BootstrapSnapshot = {
      timestamp: new Date(),
      state: this._state,
      manifest: this._manifest,
      sequence: {
        steps: [...this._steps],
        timestamp: new Date(),
      },
      metadata: { ...this._context.metadata, ...this._metadata },
    };

    return deepFreeze(snapshotObj);
  }
}
