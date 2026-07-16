import { IWorkflowEngine } from "./IWorkflowEngine";
import { WorkflowDefinition } from "./WorkflowDefinition";
import { WorkflowExecutionResult } from "./WorkflowExecutionResult";
import { WorkflowSnapshot } from "./WorkflowSnapshot";
import { WorkflowState } from "./WorkflowState";
import { WorkflowContext } from "./WorkflowContext";
import { WorkflowRegistry } from "./WorkflowRegistry";
import { WorkflowExecution } from "./WorkflowExecution";
import { InvalidWorkflowStateException, WorkflowValidationException, deepFreeze } from "./types";

export class WorkflowEngine implements IWorkflowEngine {
  private _state: WorkflowState = WorkflowState.CREATED;
  private readonly _registry = new WorkflowRegistry();
  private _activeExecutions = 0;
  private readonly _activeExecutionsMap = new Map<string, WorkflowExecution>();

  constructor(private readonly _context: WorkflowContext) {
    if (
      !_context ||
      !_context.logger ||
      !_context.aiEngine ||
      !_context.toolRegistry ||
      !_context.agentRegistry
    ) {
      throw new WorkflowValidationException("WorkflowContext has missing required services.");
    }
  }

  public get state(): WorkflowState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state !== WorkflowState.CREATED) {
      throw new InvalidWorkflowStateException("initialize", this._state);
    }
    this._state = WorkflowState.INITIALIZING;
    try {
      this._context.logger.info("Initializing Workflow Engine...");
      this._state = WorkflowState.READY;
      this._context.logger.info("Workflow Engine is READY.");
    } catch (err) {
      this._state = WorkflowState.FAILED;
      throw err;
    }
  }

  public async start(): Promise<void> {
    if (this._state !== WorkflowState.READY) {
      throw new InvalidWorkflowStateException("start", this._state);
    }
    this._context.logger.info("Starting Workflow Engine...");
    this._state = WorkflowState.RUNNING;
    this._context.logger.info("Workflow Engine is RUNNING.");
  }

  public async stop(): Promise<void> {
    if (this._state !== WorkflowState.RUNNING && this._state !== WorkflowState.READY) {
      throw new InvalidWorkflowStateException("stop", this._state);
    }
    this._context.logger.info("Stopping Workflow Engine...");
    this._state = WorkflowState.STOPPED;
    this._context.logger.info("Workflow Engine is STOPPED.");
  }

  public async register(workflow: WorkflowDefinition): Promise<void> {
    if (this._state !== WorkflowState.READY && this._state !== WorkflowState.RUNNING) {
      throw new InvalidWorkflowStateException("register", this._state);
    }
    this._registry.register(workflow);
    this._context.logger.info(`Registered workflow definition: ${workflow.name} (${workflow.id})`);
  }

  public async unregister(workflowId: string): Promise<void> {
    if (this._state !== WorkflowState.READY && this._state !== WorkflowState.RUNNING) {
      throw new InvalidWorkflowStateException("unregister", this._state);
    }
    const success = this._registry.unregister(workflowId);
    if (success) {
      this._context.logger.info(`Unregistered workflow definition: ${workflowId}`);
    }
  }

  public async execute(
    workflowId: string,
    input?: Record<string, unknown>
  ): Promise<WorkflowExecutionResult> {
    if (this._state !== WorkflowState.RUNNING) {
      throw new InvalidWorkflowStateException("execute", this._state);
    }

    const workflow = this._registry.get(workflowId);
    if (!workflow) {
      throw new WorkflowValidationException(`Workflow with ID "${workflowId}" is not registered.`);
    }

    this._activeExecutions++;
    const executionId = "exec-" + Math.random().toString(36).substring(2, 11);
    const run = new WorkflowExecution(workflow, this._context, executionId);
    this._activeExecutionsMap.set(executionId, run);

    try {
      return await run.execute(input);
    } finally {
      this._activeExecutionsMap.delete(executionId);
      this._activeExecutions--;
    }
  }

  public cancelExecution(executionId: string): boolean {
    const run = this._activeExecutionsMap.get(executionId);
    if (run) {
      run.cancel();
      return true;
    }
    return false;
  }

  public has(workflowId: string): boolean {
    return this._registry.has(workflowId);
  }

  public get(workflowId: string): WorkflowDefinition | undefined {
    return this._registry.get(workflowId);
  }

  public list(): readonly WorkflowDefinition[] {
    return this._registry.list();
  }

  public snapshot(): WorkflowSnapshot {
    return deepFreeze({
      state: this._state,
      workflowCount: this._registry.list().length,
      activeExecutions: this._activeExecutions,
      timestamp: new Date(),
      workflowIds: this._registry.getIds(),
    });
  }
}
