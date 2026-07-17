import { ExecutionSession } from "./ExecutionSession";
import { ExecutionState } from "./ExecutionState";
import { ExecutionPolicy } from "./ExecutionPolicy";

export class ExecutionBuilder {
  private _id!: string;
  private _type: "agent" | "workflow" | "tool" | "ai" | "decision" | "skill" = "agent";
  private _policy!: ExecutionPolicy;
  private _context: any;

  public withId(id: string): this {
    this._id = id;
    return this;
  }

  public withType(type: "agent" | "workflow" | "tool" | "ai" | "decision" | "skill"): this {
    this._type = type;
    return this;
  }

  public withPolicy(policy: ExecutionPolicy): this {
    this._policy = policy;
    return this;
  }

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public build(): ExecutionSession {
    if (!this._id) throw new Error("ExecutionSession ID is required");
    if (!this._policy) throw new Error("ExecutionPolicy is required");
    if (!this._context) throw new Error("Context is required");

    return {
      id: this._id,
      type: this._type,
      state: ExecutionState.CREATED,
      policy: this._policy,
      checkpoints: [],
      incidents: [],
      metrics: {
        startTime: new Date(),
        totalTokens: 0,
        totalCost: 0,
        aiCallsCount: 0,
        toolCallsCount: 0,
        recursionDepth: 0,
        retriesCount: 0,
      },
      failures: [],
      recoveryHistory: [],
      context: this._context,
    };
  }
}
