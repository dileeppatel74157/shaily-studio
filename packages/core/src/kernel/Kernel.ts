import { IKernel } from "./IKernel";
import { KernelContext } from "./KernelContext";
import { KernelMetadata } from "./KernelMetadata";
import { KernelState } from "./KernelState";
import { ServiceToken } from "./ServiceToken";
import { Version } from "./Version";
import {
  InvalidKernelStateException,
  KernelHealth,
  KernelStatus,
  ServiceAlreadyRegisteredException,
  ServiceNotFoundException,
} from "./types";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class Kernel implements IKernel {
  private readonly _kernelId: string;
  private _state: KernelState = KernelState.CREATED;
  private readonly _createdTime: Date;
  private _bootTime: Date | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _services = new Map<ServiceToken<any>, any>();
  private readonly _version: Version;
  private readonly _environment: string;

  constructor(version: Version, environment: string) {
    this._kernelId = generateUUID();
    this._createdTime = new Date();
    this._version = version;
    this._environment = environment;
  }

  // Protected Lifecycle Hooks
  protected async beforeInitialize(): Promise<void> {}
  protected async afterInitialize(): Promise<void> {}
  protected async beforeStart(): Promise<void> {}
  protected async afterStart(): Promise<void> {}
  protected async beforeStop(): Promise<void> {}
  protected async afterStop(): Promise<void> {}

  public async initialize(): Promise<void> {
    if (this._state !== KernelState.CREATED) {
      throw new InvalidKernelStateException("initialize", this._state);
    }

    this._state = KernelState.INITIALIZING;
    try {
      await this.beforeInitialize();
      await Promise.resolve();
      await this.afterInitialize();
      this._state = KernelState.READY;
    } catch (error) {
      this._state = KernelState.ERROR;
      throw error;
    }
  }

  public async start(): Promise<void> {
    if (this._state !== KernelState.READY) {
      throw new InvalidKernelStateException("start", this._state);
    }

    try {
      this._state = KernelState.RUNNING;
      this._bootTime = new Date();
      await this.beforeStart();
      await Promise.resolve();
      await this.afterStart();
    } catch (error) {
      this._state = KernelState.ERROR;
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== KernelState.RUNNING && this._state !== KernelState.READY) {
      throw new InvalidKernelStateException("stop", this._state);
    }

    this._state = KernelState.STOPPING;
    try {
      await this.beforeStop();
      await Promise.resolve();
      await this.afterStop();
      this._state = KernelState.STOPPED;
    } catch (error) {
      this._state = KernelState.ERROR;
      throw error;
    }
  }

  public register<T>(token: ServiceToken<T>, service: T): void {
    if (
      this._state !== KernelState.CREATED &&
      this._state !== KernelState.INITIALIZING &&
      this._state !== KernelState.READY
    ) {
      throw new InvalidKernelStateException(`register service: ${token.description}`, this._state);
    }

    if (this._services.has(token)) {
      throw new ServiceAlreadyRegisteredException(token);
    }

    this._services.set(token, service);
  }

  public resolve<T>(token: ServiceToken<T>): T {
    const service = this._services.get(token);
    if (service === undefined) {
      throw new ServiceNotFoundException(token);
    }
    return service as T;
  }

  public health(): KernelHealth {
    const uptime = this._bootTime ? Date.now() - this._bootTime.getTime() : 0;
    const isHealthy = this._state !== KernelState.ERROR;
    return {
      kernelId: this._kernelId,
      version: this._version,
      state: this._state,
      environment: this._environment,
      bootTime: this._bootTime,
      uptime,
      registeredServiceCount: this._services.size,
      isHealthy,
      timestamp: new Date(),
    };
  }

  public status(): KernelStatus {
    return {
      state: this._state,
      timestamp: new Date(),
      kernelId: this._kernelId,
    };
  }

  public getMetadata(): KernelMetadata {
    return {
      kernelId: this._kernelId,
      version: this._version,
      environment: this._environment,
      createdTime: this._createdTime,
      bootTime: this._bootTime,
      state: this._state,
    };
  }

  public getContext(): KernelContext {
    const serviceMetadata = Array.from(this._services.keys()).map((token) => ({
      tokenDescription: token.description,
    }));

    return {
      metadata: this.getMetadata(),
      state: this._state,
      bootTime: this._bootTime,
      environment: this._environment,
      serviceCount: this._services.size,
      serviceMetadata,
    };
  }
}
