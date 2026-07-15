import { IPlatform } from "./IPlatform";
import { IStudio } from "../studio/IStudio";
import { PlatformState } from "./PlatformState";
import { PlatformContext } from "./PlatformContext";
import { PlatformManifest } from "./PlatformManifest";
import { PlatformSnapshot } from "./PlatformSnapshot";
import {
  InvalidPlatformStateException,
  deepFreeze,
} from "./types";

export class Platform implements IPlatform {
  private _state: PlatformState = PlatformState.CREATED;
  private _startupTimestamp: Date | null = null;
  private _shutdownTimestamp: Date | null = null;

  constructor(
    public readonly studio: IStudio,
    public readonly context: PlatformContext,
    public readonly manifest: PlatformManifest,
    public readonly metadata: Readonly<Record<string, unknown>>
  ) {}

  public async initialize(): Promise<void> {
    if (this._state !== PlatformState.CREATED) {
      throw new InvalidPlatformStateException("initialize", this._state);
    }
    this._state = PlatformState.INITIALIZING;
    try {
      await this.studio.initialize();
      this._state = PlatformState.READY;
    } catch (err) {
      this._state = PlatformState.CREATED;
      throw err;
    }
  }

  public async start(): Promise<void> {
    if (this._state !== PlatformState.READY) {
      throw new InvalidPlatformStateException("start", this._state);
    }
    this._startupTimestamp = new Date();
    await this.studio.start();
    this._state = PlatformState.RUNNING;
  }

  public async stop(): Promise<void> {
    if (this._state !== PlatformState.RUNNING) {
      throw new InvalidPlatformStateException("stop", this._state);
    }
    await this.studio.stop();
    this._shutdownTimestamp = new Date();
    this._state = PlatformState.STOPPED;
  }

  public snapshot(): PlatformSnapshot {
    const snap: PlatformSnapshot = {
      state: this._state,
      metadata: this.metadata,
      manifest: this.manifest,
      startupTimestamp: this._startupTimestamp,
      shutdownTimestamp: this._shutdownTimestamp,
      studio: this.studio.snapshot(),
    };
    return deepFreeze(snap);
  }
}
