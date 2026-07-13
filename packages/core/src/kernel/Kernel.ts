import { IKernel } from "./IKernel";
import { KernelContext } from "./KernelContext";
import { KernelState } from "./KernelState";
import {
  InvalidKernelStateException,
  KernelHealth,
  ServiceAlreadyRegisteredException,
  ServiceNotFoundException,
} from "./types";

export class Kernel implements IKernel {
  private _state: KernelState = KernelState.CREATED;
  private _startTime: Date | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _services = new Map<string, any>();
  private readonly _version: string;
  private readonly _environment: string;

  constructor(version: string, environment: string) {
    this._version = version;
    this._environment = environment;
  }

  public async initialize(): Promise<void> {
    if (this._state !== KernelState.CREATED) {
      throw new InvalidKernelStateException("initialize", this._state);
    }

    this._state = KernelState.INITIALIZING;
    try {
      await Promise.resolve();
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
      this._startTime = new Date();
      await Promise.resolve();
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
      await Promise.resolve();
      this._state = KernelState.STOPPED;
    } catch (error) {
      this._state = KernelState.ERROR;
      throw error;
    }
  }

  public register<T>(name: string, service: T): void {
    if (
      this._state !== KernelState.CREATED &&
      this._state !== KernelState.INITIALIZING &&
      this._state !== KernelState.READY
    ) {
      throw new InvalidKernelStateException(`register service: ${name}`, this._state);
    }

    if (this._services.has(name)) {
      throw new ServiceAlreadyRegisteredException(name);
    }

    this._services.set(name, service);
  }

  public resolve<T>(name: string): T {
    const service = this._services.get(name);
    if (service === undefined) {
      throw new ServiceNotFoundException(name);
    }
    return service as T;
  }

  public health(): KernelHealth {
    const uptime = this._startTime ? Date.now() - this._startTime.getTime() : 0;
    return {
      state: this._state,
      uptime,
      version: this._version,
      environment: this._environment,
      registeredServiceCount: this._services.size,
    };
  }

  public status(): KernelState {
    return this._state;
  }

  public getContext(): KernelContext {
    return {
      state: this._state,
      startTime: this._startTime,
      registeredServices: Array.from(this._services.keys()),
      version: this._version,
      environment: this._environment,
    };
  }
}
