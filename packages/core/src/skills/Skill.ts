import { ISkill } from "./ISkill";
import { SkillState } from "./SkillState";
import { SkillManifest } from "./SkillManifest";
import { SkillContext } from "./SkillContext";
import { SkillConfiguration } from "./SkillConfiguration";
import { SkillExecutionResult } from "./SkillExecutionResult";
import { InvalidSkillStateException } from "./types";

export type SkillExecutorFn = (input?: any, context?: SkillContext) => Promise<any>;

export class Skill implements ISkill {
  private _state: SkillState = SkillState.CREATED;

  constructor(
    public readonly manifest: SkillManifest,
    public readonly context: SkillContext,
    private readonly _executor: SkillExecutorFn,
    public readonly configuration?: SkillConfiguration
  ) {}

  public get id(): string {
    return this.manifest.metadata.id;
  }

  public get name(): string {
    return this.manifest.metadata.name;
  }

  public get description(): string {
    return this.manifest.metadata.description;
  }

  public get state(): SkillState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state !== SkillState.CREATED) {
      throw new InvalidSkillStateException(this.id, "initialize", this._state);
    }
    this._state = SkillState.INITIALIZED;
    // For general testing, move from INITIALIZED directly to READY
    this._state = SkillState.READY;
  }

  public async execute(input?: unknown): Promise<SkillExecutionResult> {
    if (this._state !== SkillState.READY && this._state !== SkillState.RUNNING) {
      throw new InvalidSkillStateException(this.id, "execute", this._state);
    }

    const prevState = this._state;
    this._state = SkillState.RUNNING;
    const startTime = Date.now();
    const executionId = "exec-" + Math.random().toString(36).substring(2, 11);

    try {
      const output = await this._executor(input, this.context);
      this._state = prevState;
      return {
        executionId,
        success: true,
        output,
        runtimeMs: Date.now() - startTime,
      };
    } catch (err: any) {
      this._state = SkillState.FAILED;
      return {
        executionId,
        success: false,
        error: err.message || String(err),
        runtimeMs: Date.now() - startTime,
      };
    }
  }

  public async stop(): Promise<void> {
    this._state = SkillState.STOPPED;
  }

  public setState(state: SkillState): void {
    this._state = state;
  }
}
