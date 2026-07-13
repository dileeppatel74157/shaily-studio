import { JobStatus } from "./JobStatus";
import { JobPriority } from "./JobPriority";
import { JobContext } from "./JobContext";
import { JobSnapshot } from "./JobSnapshot";
import { InvalidJobStateException } from "./types";

export class Job<TContext = any, TResult = any> {
  private _status: JobStatus = JobStatus.PENDING;
  private _startedAt?: Date;
  private _completedAt?: Date;
  private _result?: TResult;
  private _error?: Error;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly priority: JobPriority,
    public readonly correlationId: string,
    public readonly createdAt: Date,
    public readonly context: TContext,
    public readonly metadata: Record<string, unknown>,
    private readonly _execute: (context: JobContext) => Promise<TResult>
  ) {}

  public get status(): JobStatus {
    return this._status;
  }

  public get startedAt(): Date | undefined {
    return this._startedAt;
  }

  public get completedAt(): Date | undefined {
    return this._completedAt;
  }

  public get result(): TResult | undefined {
    return this._result;
  }

  public get error(): Error | undefined {
    return this._error;
  }

  public queue(): void {
    this.ensureMutable("queue");
    this._status = JobStatus.QUEUED;
  }

  public start(date: Date): void {
    this.ensureMutable("start");
    this._status = JobStatus.RUNNING;
    this._startedAt = date;
  }

  public complete(date: Date, result: TResult): void {
    this.ensureMutable("complete");
    this._status = JobStatus.COMPLETED;
    this._completedAt = date;
    this._result = result;
    this.freeze();
  }

  public fail(date: Date, error: Error): void {
    this.ensureMutable("fail");
    this._status = JobStatus.FAILED;
    this._completedAt = date;
    this._error = error;
    this.freeze();
  }

  public cancel(date: Date): void {
    this.ensureMutable("cancel");
    this._status = JobStatus.CANCELLED;
    this._completedAt = date;
    this.freeze();
  }

  public async execute(context: JobContext): Promise<TResult> {
    return this._execute(context);
  }

  public toSnapshot(): JobSnapshot {
    return Object.freeze({
      id: this.id,
      name: this.name,
      status: this._status,
      priority: this.priority,
      correlationId: this.correlationId,
      createdAt: new Date(this.createdAt),
      startedAt: this._startedAt ? new Date(this._startedAt) : undefined,
      completedAt: this._completedAt ? new Date(this._completedAt) : undefined,
      context: this.context ? JSON.parse(JSON.stringify(this.context)) : undefined,
      metadata: this.metadata ? JSON.parse(JSON.stringify(this.metadata)) : {},
      result: this._result !== undefined ? JSON.parse(JSON.stringify(this._result)) : undefined,
      error: this._error?.message,
    });
  }

  private ensureMutable(action: string): void {
    if (
      this._status === JobStatus.COMPLETED ||
      this._status === JobStatus.FAILED ||
      this._status === JobStatus.CANCELLED
    ) {
      throw new InvalidJobStateException(this.id, action, this._status);
    }
  }

  private freeze(): void {
    Object.freeze(this);
    if (this.metadata) {
      Object.freeze(this.metadata);
    }
  }
}
