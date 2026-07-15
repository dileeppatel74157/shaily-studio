import { IRuntime } from "./IRuntime";
import { RuntimeSessionDescriptor } from "./RuntimeSessionDescriptor";
import { RuntimeSession } from "./RuntimeSession";
import { RuntimeSnapshot } from "./RuntimeSnapshot";
import { RuntimeContext } from "./RuntimeContext";
import { RuntimeState } from "./RuntimeState";
import { RuntimeSessionRegistry } from "./RuntimeSessionRegistry";
import { RuntimeValidator } from "./RuntimeValidator";
import { IHost } from "../host/IHost";
import {
  RuntimeValidationException,
  InvalidRuntimeStateException,
  deepFreeze,
} from "./types";

export class Runtime implements IRuntime {
  private readonly _context: RuntimeContext;
  private readonly _host: IHost;
  private readonly _registry = new RuntimeSessionRegistry();
  private readonly _metadata: Readonly<Record<string, unknown>>;
  private _state: RuntimeState = RuntimeState.CREATED;

  constructor(
    context: RuntimeContext,
    host: IHost,
    metadata?: Record<string, unknown>
  ) {
    RuntimeValidator.validateContext(context);
    if (!host) {
      throw new RuntimeValidationException("Host is required");
    }
    this._context = context;
    this._host = host;
    this._metadata = metadata ? { ...metadata } : {};
  }

  public async initialize(): Promise<void> {
    if (this._state !== RuntimeState.CREATED) {
      throw new InvalidRuntimeStateException("initialize", this._state);
    }
    this._state = RuntimeState.INITIALIZING;
    try {
      await this._host.initialize();
      this._state = RuntimeState.READY;
    } catch (err) {
      this._state = RuntimeState.FAILED;
      throw err;
    }
  }

  public async start(): Promise<void> {
    if (this._state !== RuntimeState.READY) {
      throw new InvalidRuntimeStateException("start", this._state);
    }
    try {
      await this._host.start();
      this._state = RuntimeState.RUNNING;
    } catch (err) {
      this._state = RuntimeState.FAILED;
      throw err;
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== RuntimeState.RUNNING) {
      throw new InvalidRuntimeStateException("stop", this._state);
    }
    try {
      // 1. Destroy all active sessions first
      const list = this._registry.list();
      for (const s of list) {
        await this.destroySession(s.id);
      }

      // 2. Stop Runtime next
      this._state = RuntimeState.STOPPED;

      // 3. Stop Host last
      await this._host.stop();
    } catch (err) {
      this._state = RuntimeState.FAILED;
      throw err;
    }
  }

  public async createSession(
    descriptor: RuntimeSessionDescriptor
  ): Promise<RuntimeSession> {
    if (this._state !== RuntimeState.RUNNING) {
      throw new InvalidRuntimeStateException("createSession", this._state);
    }
    RuntimeValidator.validateDescriptor(descriptor);

    if (this._registry.has(descriptor.id)) {
      throw new RuntimeValidationException(`Session with ID "${descriptor.id}" already exists`);
    }

    const session: RuntimeSession = {
      id: descriptor.id,
      createdAt: new Date(),
      state: "ACTIVE",
      metadata: descriptor.metadata ? { ...descriptor.metadata } : {},
    };

    this._registry.register(session);
    return deepFreeze(session);
  }

  public async destroySession(sessionId: string): Promise<void> {
    if (this._state !== RuntimeState.RUNNING) {
      throw new InvalidRuntimeStateException("destroySession", this._state);
    }
    RuntimeValidator.validateIdentifier(sessionId, "Session ID");

    if (!this._registry.has(sessionId)) {
      throw new RuntimeValidationException(`Session with ID "${sessionId}" does not exist`);
    }

    this._registry.unregister(sessionId);
  }

  public hasSession(sessionId: string): boolean {
    if (this._state !== RuntimeState.RUNNING) {
      throw new InvalidRuntimeStateException("hasSession", this._state);
    }
    RuntimeValidator.validateIdentifier(sessionId, "Session ID");
    return this._registry.has(sessionId);
  }

  public getSession(sessionId: string): RuntimeSession | undefined {
    if (this._state !== RuntimeState.RUNNING) {
      throw new InvalidRuntimeStateException("getSession", this._state);
    }
    RuntimeValidator.validateIdentifier(sessionId, "Session ID");
    const session = this._registry.get(sessionId);
    return session ? deepFreeze(session) : undefined;
  }

  public listSessions(): readonly RuntimeSession[] {
    if (this._state !== RuntimeState.RUNNING) {
      throw new InvalidRuntimeStateException("listSessions", this._state);
    }
    const list = this._registry.list();
    return deepFreeze(list);
  }

  public snapshot(): RuntimeSnapshot {
    if (this._state !== RuntimeState.RUNNING && this._state !== RuntimeState.STOPPED) {
      throw new InvalidRuntimeStateException("snapshot", this._state);
    }

    const sessions = this._registry.list();

    const snapshotObj: RuntimeSnapshot = {
      timestamp: new Date(),
      state: this._state,
      sessions,
      metadata: { ...this._context.metadata, ...this._metadata },
    };

    return deepFreeze(snapshotObj);
  }
}
