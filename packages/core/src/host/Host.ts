import { IHost } from "./IHost";
import { HostedService } from "./HostedService";
import { HostSnapshot } from "./HostSnapshot";
import { HostContext } from "./HostContext";
import { HostState } from "./HostState";
import { HostedServiceRegistry } from "./HostedServiceRegistry";
import { HostValidator } from "./HostValidator";
import { IBootstrapper } from "../bootstrap/IBootstrapper";
import {
  HostValidationException,
  InvalidHostStateException,
  deepFreeze,
} from "./types";

export class Host implements IHost {
  private readonly _context: HostContext;
  private readonly _bootstrapper: IBootstrapper;
  private readonly _registry = new HostedServiceRegistry();
  private readonly _metadata: Readonly<Record<string, unknown>>;
  private _state: HostState = HostState.CREATED;

  constructor(
    context: HostContext,
    bootstrapper: IBootstrapper,
    metadata?: Record<string, unknown>
  ) {
    HostValidator.validateContext(context);
    if (!bootstrapper) {
      throw new HostValidationException("Bootstrapper is required");
    }
    this._context = context;
    this._bootstrapper = bootstrapper;
    this._metadata = metadata ? { ...metadata } : {};
  }

  public async initialize(): Promise<void> {
    if (this._state !== HostState.CREATED) {
      throw new InvalidHostStateException("initialize", this._state);
    }
    this._state = HostState.INITIALIZING;
    try {
      await this._bootstrapper.initialize();

      const services = this._registry.list();
      for (const s of services) {
        await s.initialize();
      }

      this._state = HostState.READY;
    } catch (err) {
      this._state = HostState.FAILED;
      throw err;
    }
  }

  public async start(): Promise<void> {
    if (this._state !== HostState.READY) {
      throw new InvalidHostStateException("start", this._state);
    }
    try {
      await this._bootstrapper.bootstrap();

      const services = this._registry.list();
      for (const s of services) {
        await s.start();
      }

      this._state = HostState.RUNNING;
    } catch (err) {
      this._state = HostState.FAILED;
      throw err;
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== HostState.RUNNING) {
      throw new InvalidHostStateException("stop", this._state);
    }
    try {
      // 1. Stop Hosted Services first
      const services = this._registry.list();
      for (const s of services) {
        await s.stop();
      }

      // 2. Shut down Kernel & Bootstrapper next
      await this._bootstrapper.shutdown();

      this._state = HostState.STOPPED;
    } catch (err) {
      this._state = HostState.FAILED;
      throw err;
    }
  }

  public async register(service: HostedService): Promise<void> {
    if (
      this._state !== HostState.CREATED &&
      this._state !== HostState.INITIALIZING &&
      this._state !== HostState.READY
    ) {
      throw new InvalidHostStateException("register", this._state);
    }
    HostValidator.validateService(service);
    this._registry.register(service);
  }

  public async unregister(serviceId: string): Promise<void> {
    if (
      this._state !== HostState.CREATED &&
      this._state !== HostState.INITIALIZING &&
      this._state !== HostState.READY
    ) {
      throw new InvalidHostStateException("unregister", this._state);
    }
    HostValidator.validateIdentifier(serviceId, "Service ID");
    this._registry.unregister(serviceId);
  }

  public has(serviceId: string): boolean {
    return this._registry.has(serviceId);
  }

  public get(serviceId: string): HostedService | undefined {
    return this._registry.get(serviceId);
  }

  public list(): readonly HostedService[] {
    return this._registry.list();
  }

  public snapshot(): HostSnapshot {
    if (this._state !== HostState.RUNNING && this._state !== HostState.STOPPED) {
      throw new InvalidHostStateException("snapshot", this._state);
    }

    const services = this._registry.list();

    const snapshotObj: HostSnapshot = {
      timestamp: new Date(),
      state: this._state,
      services,
      metadata: { ...this._context.metadata, ...this._metadata },
    };

    return deepFreeze(snapshotObj);
  }
}
