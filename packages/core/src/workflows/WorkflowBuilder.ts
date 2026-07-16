import { WorkflowDefinition } from "./WorkflowDefinition";
import { WorkflowStep, WorkflowStepType, RetryPolicy } from "./WorkflowStep";
import { WorkflowVariable, WorkflowVariableType } from "./WorkflowVariable";
import { WorkflowTrigger, WorkflowTriggerType } from "./WorkflowTrigger";
import { WorkflowMetadata } from "./WorkflowMetadata";
import { WorkflowCapability } from "./WorkflowCapability";

export class WorkflowBuilder {
  private _id = "";
  private _name = "";
  private _version = "1.0.0";
  private _description = "";
  private _trigger?: WorkflowTrigger;
  private readonly _variables: WorkflowVariable[] = [];
  private readonly _steps: WorkflowStep[] = [];
  private _metadata?: WorkflowMetadata;
  private readonly _capabilities: WorkflowCapability[] = [];

  public withId(id: string): this {
    this._id = id;
    return this;
  }

  public withName(name: string): this {
    this._name = name;
    return this;
  }

  public withVersion(version: string): this {
    this._version = version;
    return this;
  }

  public withDescription(description: string): this {
    this._description = description;
    return this;
  }

  public withManualTrigger(): this {
    this._trigger = { type: WorkflowTriggerType.MANUAL };
    return this;
  }

  public withEventTrigger(eventName: string): this {
    this._trigger = { type: WorkflowTriggerType.EVENT, eventName };
    return this;
  }

  public withScheduleTrigger(cronExpression: string): this {
    this._trigger = { type: WorkflowTriggerType.SCHEDULE, cronExpression };
    return this;
  }

  public withVariable(
    name: string,
    type: WorkflowVariableType,
    defaultValue?: any,
    description?: string,
    required?: boolean
  ): this {
    this._variables.push({ name, type, defaultValue, description, required });
    return this;
  }

  public addStep(step: WorkflowStep): this {
    this._steps.push(step);
    return this;
  }

  public withMetadata(metadata: WorkflowMetadata): this {
    this._metadata = metadata;
    return this;
  }

  public withCapability(name: string, value?: string): this {
    this._capabilities.push({ name, value });
    return this;
  }

  public build(): WorkflowDefinition {
    return {
      id: this._id,
      name: this._name,
      version: this._version,
      description: this._description,
      trigger: this._trigger,
      variables: this._variables,
      steps: this._steps,
      metadata: this._metadata,
      capabilities: this._capabilities,
    };
  }
}

export class WorkflowStepBuilder {
  private _id = "";
  private _name = "";
  private _type!: WorkflowStepType;
  private _retryPolicy?: RetryPolicy;
  private _timeoutMs?: number;
  private _onFailure?: "fail" | "continue" | "rollback";
  private _rollbackStepId?: string;
  private _config: Record<string, any> = {};

  constructor(id: string, name: string, type: WorkflowStepType) {
    this._id = id;
    this._name = name;
    this._type = type;
  }

  public static prompt(id: string, name: string): WorkflowStepBuilder {
    return new WorkflowStepBuilder(id, name, WorkflowStepType.PROMPT);
  }

  public static aiCompletion(id: string, name: string): WorkflowStepBuilder {
    return new WorkflowStepBuilder(id, name, WorkflowStepType.AI_COMPLETION);
  }

  public static toolCall(id: string, name: string): WorkflowStepBuilder {
    return new WorkflowStepBuilder(id, name, WorkflowStepType.TOOL_CALL);
  }

  public static agentExecution(id: string, name: string): WorkflowStepBuilder {
    return new WorkflowStepBuilder(id, name, WorkflowStepType.AGENT_EXECUTION);
  }

  public static ragRetrieval(id: string, name: string): WorkflowStepBuilder {
    return new WorkflowStepBuilder(id, name, WorkflowStepType.RAG_RETRIEVAL);
  }

  public static conditionalBranch(id: string, name: string): WorkflowStepBuilder {
    return new WorkflowStepBuilder(id, name, WorkflowStepType.CONDITIONAL_BRANCH);
  }

  public static loop(id: string, name: string): WorkflowStepBuilder {
    return new WorkflowStepBuilder(id, name, WorkflowStepType.LOOP);
  }

  public static variableAssignment(id: string, name: string): WorkflowStepBuilder {
    return new WorkflowStepBuilder(id, name, WorkflowStepType.VARIABLE_ASSIGNMENT);
  }

  public static delay(id: string, name: string): WorkflowStepBuilder {
    return new WorkflowStepBuilder(id, name, WorkflowStepType.DELAY);
  }

  public static parallelBranch(id: string, name: string): WorkflowStepBuilder {
    return new WorkflowStepBuilder(id, name, WorkflowStepType.PARALLEL_BRANCH);
  }

  public static sequentialBranch(id: string, name: string): WorkflowStepBuilder {
    return new WorkflowStepBuilder(id, name, WorkflowStepType.SEQUENTIAL_BRANCH);
  }

  public static terminate(id: string, name: string): WorkflowStepBuilder {
    return new WorkflowStepBuilder(id, name, WorkflowStepType.TERMINATE);
  }

  public withRetryPolicy(maxRetries: number, delayMs: number, backoffFactor?: number): this {
    this._retryPolicy = { maxRetries, delayMs, backoffFactor };
    return this;
  }

  public withTimeout(timeoutMs: number): this {
    this._timeoutMs = timeoutMs;
    return this;
  }

  public onFailure(action: "fail" | "continue" | "rollback", rollbackStepId?: string): this {
    this._onFailure = action;
    this._rollbackStepId = rollbackStepId;
    return this;
  }

  public withConfig(key: string, value: any): this {
    this._config[key] = value;
    return this;
  }

  public build(): WorkflowStep {
    return {
      id: this._id,
      name: this._name,
      type: this._type,
      retryPolicy: this._retryPolicy,
      timeoutMs: this._timeoutMs,
      onFailure: this._onFailure,
      rollbackStepId: this._rollbackStepId,
      ...this._config,
    };
  }
}
