import { Job } from "./Job";
import { JobPriority } from "./JobPriority";
import { JobContext } from "./JobContext";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class JobBuilder<TContext = any, TResult = any> {
  private _id = generateUUID();
  private _name?: string;
  private _priority = JobPriority.NORMAL;
  private _correlationId = generateUUID();
  private _createdAt = new Date();
  private _context!: TContext;
  private _metadata: Record<string, unknown> = {};
  private _execute?: (context: JobContext) => Promise<TResult>;

  public withId(id: string): this {
    this._id = id;
    return this;
  }

  public withName(name: string): this {
    this._name = name;
    return this;
  }

  public withPriority(priority: JobPriority): this {
    this._priority = priority;
    return this;
  }

  public withCorrelationId(correlationId: string): this {
    this._correlationId = correlationId;
    return this;
  }

  public withCreatedAt(createdAt: Date): this {
    this._createdAt = createdAt;
    return this;
  }

  public withContext(context: TContext): this {
    this._context = context;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...metadata };
    return this;
  }

  public withExecution(execute: (context: JobContext) => Promise<TResult>): this {
    this._execute = execute;
    return this;
  }

  public build(): Job<TContext, TResult> {
    if (!this._name) {
      throw new Error("Job name is required to build a Job.");
    }
    if (!this._execute) {
      throw new Error("Job execution function is required to build a Job.");
    }
    return new Job<TContext, TResult>(
      this._id,
      this._name,
      this._priority,
      this._correlationId,
      this._createdAt,
      this._context,
      this._metadata,
      this._execute
    );
  }
}
