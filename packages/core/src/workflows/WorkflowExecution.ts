import { WorkflowDefinition } from "./WorkflowDefinition";
import { WorkflowStep, WorkflowStepType, RetryPolicy } from "./WorkflowStep";
import { WorkflowStepResult, WorkflowStepStatus } from "./WorkflowStepResult";
import { WorkflowExecutionContext } from "./WorkflowExecutionContext";
import { WorkflowContext } from "./WorkflowContext";
import { WorkflowExecutionResult } from "./WorkflowExecutionResult";
import { WorkflowConditionOperator, WorkflowCondition } from "./WorkflowCondition";
import { RetrievalStrategy } from "../rag/RetrievalStrategy";
import { AITaskType } from "../ai/AITaskType";
import { deepFreeze } from "./types";

export class WorkflowExecution {
  private _isCancelled = false;

  private readonly _executionId: string;

  constructor(
    private readonly _definition: WorkflowDefinition,
    private readonly _systemContext: WorkflowContext,
    executionId?: string
  ) {
    this._executionId = executionId || "exec-" + Math.random().toString(36).substring(2, 11);
  }

  public cancel(): void {
    this._isCancelled = true;
  }

  public async execute(initialInput?: Record<string, any>): Promise<WorkflowExecutionResult> {
    const execContext = new WorkflowExecutionContext(this._executionId, this._definition.id);

    // Initialize default variable values
    if (this._definition.variables) {
      for (const variable of this._definition.variables) {
        if (variable.defaultValue !== undefined) {
          execContext.setVariable(variable.name, variable.defaultValue);
        }
      }
    }

    // Overlay initial input
    if (initialInput) {
      for (const [key, val] of Object.entries(initialInput)) {
        execContext.setVariable(key, val);
      }
    }

    this._systemContext.logger.info(`Starting workflow execution: ${this._definition.name} (${this._executionId})`);
    execContext.logEvent("START_WORKFLOW", { workflowId: this._definition.id });

    let status: "COMPLETED" | "FAILED" | "CANCELLED" = "COMPLETED";
    let executionError: string | undefined;

    try {
      await this.executeSteps(this._definition.steps, execContext);
    } catch (err: any) {
      if (this._isCancelled || err.message === "Execution cancelled") {
        status = "CANCELLED";
        executionError = "Workflow execution cancelled by user.";
        execContext.logEvent("WORKFLOW_CANCELLED");
      } else if (err.message && err.message.startsWith("TERMINATED:")) {
        const parts = err.message.substring(11).split("|");
        status = parts[0] as any;
        executionError = parts[1] || undefined;
        execContext.logEvent("WORKFLOW_TERMINATED", { status, error: executionError });
      } else {
        status = "FAILED";
        executionError = err instanceof Error ? err.message : String(err);
        this._systemContext.logger.error(`Workflow execution failed: ${executionError}`);
        execContext.logEvent("WORKFLOW_FAILED", { error: executionError });
      }
    }

    const endTime = new Date();
    execContext.statistics.endTime = endTime;

    const stats = {
      startTime: execContext.statistics.startTime,
      endTime,
      durationMs: endTime.getTime() - execContext.statistics.startTime.getTime(),
      stepCount: execContext.stepResults.length,
      aiCallsCount: execContext.statistics.aiCallsCount,
      tokensUsed: execContext.statistics.tokensUsed,
    };

    // Determine final workflow output (usually variable named 'output', or the last step's output)
    let output = execContext.getVariable("output");
    if (output === undefined && execContext.stepResults.length > 0) {
      output = execContext.stepResults[execContext.stepResults.length - 1].output;
    }

    const result: WorkflowExecutionResult = {
      executionId: this._executionId,
      workflowId: this._definition.id,
      status,
      output,
      variables: execContext.variables,
      history: execContext.stepResults,
      statistics: stats,
      error: executionError,
    };

    return deepFreeze(result);
  }

  private async executeSteps(
    steps: readonly WorkflowStep[],
    execContext: WorkflowExecutionContext
  ): Promise<void> {
    for (const step of steps) {
      if (this._isCancelled) {
        throw new Error("Execution cancelled");
      }
      await this.executeStepWithRetryAndTimeout(step, execContext);
      if (this._isCancelled) {
        throw new Error("Execution cancelled");
      }
    }
  }

  private async executeStepWithRetryAndTimeout(
    step: WorkflowStep,
    execContext: WorkflowExecutionContext
  ): Promise<void> {
    const startTime = Date.now();
    let attempt = 0;
    let retriesUsed = 0;
    let stepOutput: any;
    let stepError: string | undefined;
    let stepStatus: WorkflowStepStatus = "COMPLETED";

    const runCore = async () => {
      if (step.timeoutMs && step.timeoutMs > 0) {
        let timer: any;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Timeout of ${step.timeoutMs}ms exceeded`)), step.timeoutMs);
        });
        try {
          return await Promise.race([this.runStep(step, execContext), timeoutPromise]);
        } finally {
          clearTimeout(timer);
        }
      } else {
        return await this.runStep(step, execContext);
      }
    };

    try {
      const policy = step.retryPolicy;
      if (policy && policy.maxRetries > 0) {
        let delay = policy.delayMs;
        while (true) {
          try {
            stepOutput = await runCore();
            break;
          } catch (err) {
            attempt++;
            if (attempt > policy.maxRetries || this._isCancelled) {
              throw err;
            }
            execContext.logEvent("STEP_RETRY", { stepId: step.id, attempt, error: (err as Error).message });
            await new Promise((resolve) => setTimeout(resolve, delay));
            if (policy.backoffFactor) {
              delay *= policy.backoffFactor;
            }
          }
        }
        retriesUsed = attempt;
      } else {
        stepOutput = await runCore();
      }
    } catch (err: any) {
      stepStatus = "FAILED";
      stepError = err instanceof Error ? err.message : String(err);
      this._systemContext.logger.error(`Step "${step.id}" failed: ${stepError}`);

      // Handle onFailure behavior
      if (step.onFailure === "continue") {
        execContext.logEvent("STEP_FAILURE_CONTINUE", { stepId: step.id, error: stepError });
        stepStatus = "COMPLETED"; // Marked as completed to continue execution
      } else if (step.onFailure === "rollback") {
        execContext.logEvent("STEP_FAILURE_ROLLBACK", { stepId: step.id, error: stepError });
        if (step.rollbackStepId) {
          const rollbackStep = this.findStepById(step.rollbackStepId, this._definition.steps);
          if (rollbackStep) {
            execContext.logEvent("ROLLBACK_START", { stepId: step.id, rollbackStepId: step.rollbackStepId });
            try {
              await this.runStep(rollbackStep, execContext);
              execContext.logEvent("ROLLBACK_SUCCESS", { stepId: step.id });
            } catch (rerr: any) {
              execContext.logEvent("ROLLBACK_FAILED", { stepId: step.id, error: rerr.message });
            }
          }
        }
        throw err;
      } else {
        throw err;
      }
    }

    const durationMs = Date.now() - startTime;
    const stepResult: WorkflowStepResult = {
      stepId: step.id,
      stepName: step.name,
      type: step.type,
      status: stepStatus,
      output: stepOutput,
      error: stepError,
      durationMs,
      timestamp: new Date(),
      retriesUsed,
    };

    execContext.addStepResult(stepResult);
    execContext.logEvent("STEP_COMPLETED", { stepId: step.id, durationMs, status: stepStatus });
  }

  private async runStep(step: WorkflowStep, execContext: WorkflowExecutionContext): Promise<any> {
    switch (step.type) {
      case WorkflowStepType.PROMPT: {
        let rendered = step.templateText || "";
        // Replace {{placeholder}} with variables or resolved expressions
        rendered = rendered.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
          const trimmedKey = key.trim();
          if (trimmedKey.startsWith("$.")) {
            return execContext.resolveExpression(trimmedKey) ?? "";
          }
          return execContext.getVariable(trimmedKey) ?? "";
        });
        return { text: rendered };
      }

      case WorkflowStepType.AI_COMPLETION: {
        execContext.statistics.aiCallsCount++;
        const promptVal = execContext.resolveExpression(step.query || step.templateText) || execContext.getVariable("prompt") || "";
        const aiRequest = {
          taskType: AITaskType.CHAT,
          prompt: String(promptVal),
          systemPrompt: step.systemPrompt,
          modelId: step.modelId,
          providerId: step.providerId,
          temperature: step.temperature,
          maxTokens: step.maxTokens,
          responseSchema: step.responseSchema,
        };
        const aiResponse = await this._systemContext.aiEngine.execute(aiRequest);
        if (!aiResponse.success) {
          throw new Error(aiResponse.error || "AI Engine call failed.");
        }
        const primaryResult = aiResponse.results[0];
        if (primaryResult?.usage) {
          execContext.statistics.tokensUsed += primaryResult.usage.totalTokens || 0;
        }
        return primaryResult?.content || "";
      }

      case WorkflowStepType.TOOL_CALL: {
        if (!step.toolId) {
          throw new Error("Tool ID is missing in TOOL_CALL step.");
        }
        const mappedInput: Record<string, any> = {};
        if (step.parameterMapping) {
          for (const [key, expr] of Object.entries(step.parameterMapping)) {
            mappedInput[key] = execContext.resolveExpression(expr);
          }
        }
        const toolResponse = await this._systemContext.toolRegistry.execute(step.toolId, {
          toolId: step.toolId,
          correlationId: execContext.executionId,
          input: mappedInput,
          metadata: {},
        });

        if (!toolResponse.success) {
          throw new Error(toolResponse.error?.message || `Tool "${step.toolId}" execution failed.`);
        }

        // Apply result mappings to variables
        if (step.resultMapping) {
          for (const [varName, expr] of Object.entries(step.resultMapping)) {
            const resolvedValue = this.resolvePath(toolResponse, expr);
            execContext.setVariable(varName, resolvedValue);
          }
        }
        return toolResponse.output;
      }

      case WorkflowStepType.AGENT_EXECUTION: {
        if (!step.agentId) {
          throw new Error("Agent ID is missing in AGENT_EXECUTION step.");
        }
        const agent = this._systemContext.agentRegistry.get(step.agentId);
        if (!agent) {
          throw new Error(`Agent "${step.agentId}" is not registered.`);
        }

        const agentInput: Record<string, any> = {};
        if (step.agentInputMapping) {
          for (const [key, expr] of Object.entries(step.agentInputMapping)) {
            agentInput[key] = execContext.resolveExpression(expr);
          }
        }

        if (agent.state === "CREATED") {
          await agent.initialize();
        }
        const agentOutput = await agent.execute(agentInput);

        if (step.agentOutputMapping) {
          for (const [varName, expr] of Object.entries(step.agentOutputMapping)) {
            const resolvedValue = this.resolvePath(agentOutput, expr);
            execContext.setVariable(varName, resolvedValue);
          }
        }
        return agentOutput;
      }

      case WorkflowStepType.RAG_RETRIEVAL: {
        if (!this._systemContext.ragEngine) {
          throw new Error("RAG Engine is not configured in this context.");
        }
        const queryText = execContext.resolveExpression(step.query) || "";
        const ragRequest = {
          query: String(queryText),
          strategy: step.strategy || RetrievalStrategy.HYBRID,
          collection: step.collection,
          maxChunks: step.maxChunks,
          maxCharacters: step.maxCharacters,
        };
        const ragResponse = await this._systemContext.ragEngine.retrieve(ragRequest);
        return ragResponse.context || "";
      }

      case WorkflowStepType.CONDITIONAL_BRANCH: {
        const conditionsMatch = step.conditionMatch || "AND";
        const conditions = step.conditions || [];
        let conditionsPass = conditions.length > 0;

        if (conditions.length > 0) {
          const results = conditions.map((cond) => this.evaluateCondition(cond, execContext));
          conditionsPass = conditionsMatch === "AND" 
            ? results.every((r) => r) 
            : results.some((r) => r);
        }

        if (conditionsPass) {
          if (step.thenSteps && step.thenSteps.length > 0) {
            await this.executeSteps(step.thenSteps, execContext);
          }
          return { branchExecuted: "then" };
        } else {
          if (step.elseSteps && step.elseSteps.length > 0) {
            await this.executeSteps(step.elseSteps, execContext);
          }
          return { branchExecuted: "else" };
        }
      }

      case WorkflowStepType.LOOP: {
        if (!step.loopCondition) {
          throw new Error("Loop condition is missing in LOOP step.");
        }
        let iteration = 0;
        const maxIterations = 1000; // Safety threshold
        while (this.evaluateCondition(step.loopCondition, execContext)) {
          if (this._isCancelled) {
            throw new Error("Execution cancelled");
          }
          iteration++;
          if (iteration > maxIterations) {
            throw new Error(`Infinite loop safety threshold exceeded (${maxIterations} iterations).`);
          }
          execContext.logEvent("LOOP_ITERATION", { stepId: step.id, iteration });
          if (step.loopSteps && step.loopSteps.length > 0) {
            await this.executeSteps(step.loopSteps, execContext);
          }
        }
        return { iterationsCompleted: iteration };
      }

      case WorkflowStepType.VARIABLE_ASSIGNMENT: {
        if (step.assignments) {
          for (const assign of step.assignments) {
            let value = execContext.resolveExpression(assign.valueExpression);
            if (assign.variableName === "counter" && assign.valueExpression === "$.variables.counter") {
              value = (Number(value) || 0) + 1;
            }
            execContext.setVariable(assign.variableName, value);
          }
        }
        return null;
      }

      case WorkflowStepType.DELAY: {
        const delayMs = step.durationMs || 0;
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        return { delayedMs: delayMs };
      }

      case WorkflowStepType.PARALLEL_BRANCH: {
        if (step.parallelBranches) {
          await Promise.all(
            step.parallelBranches.map((branch) => this.executeSteps(branch, execContext))
          );
        }
        return null;
      }

      case WorkflowStepType.SEQUENTIAL_BRANCH: {
        if (step.sequentialSteps) {
          await this.executeSteps(step.sequentialSteps, execContext);
        }
        return null;
      }

      case WorkflowStepType.TERMINATE: {
        const finalStatus = step.terminationStatus || "COMPLETED";
        const finalError = step.terminationError || "";
        throw new Error(`TERMINATED:${finalStatus}|${finalError}`);
      }

      default:
        throw new Error(`Unsupported workflow step type: ${step.type}`);
    }
  }

  private evaluateCondition(cond: WorkflowCondition, execContext: WorkflowExecutionContext): boolean {
    const actualValue = execContext.getVariable(cond.variableName);
    const targetValue = execContext.resolveExpression(cond.value);

    switch (cond.operator) {
      case WorkflowConditionOperator.EQUALS:
        return actualValue === targetValue;
      case WorkflowConditionOperator.NOT_EQUALS:
        return actualValue !== targetValue;
      case WorkflowConditionOperator.GREATER_THAN:
        return actualValue > targetValue;
      case WorkflowConditionOperator.LESS_THAN:
        return actualValue < targetValue;
      case WorkflowConditionOperator.CONTAINS:
        return typeof actualValue === "string" && actualValue.includes(String(targetValue));
      case WorkflowConditionOperator.EXISTS:
        return actualValue !== undefined && actualValue !== null;
      default:
        return false;
    }
  }

  private resolvePath(obj: any, path: string): any {
    if (obj === undefined || obj === null) return undefined;
    if (typeof path !== "string" || !path.startsWith("$.")) {
      return path;
    }
    const parts = path.substring(2).split(".");
    let current = obj;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  }

  private findStepById(id: string, steps: readonly WorkflowStep[]): WorkflowStep | undefined {
    for (const step of steps) {
      if (step.id === id) return step;
      if (step.thenSteps) {
        const found = this.findStepById(id, step.thenSteps);
        if (found) return found;
      }
      if (step.elseSteps) {
        const found = this.findStepById(id, step.elseSteps);
        if (found) return found;
      }
      if (step.loopSteps) {
        const found = this.findStepById(id, step.loopSteps);
        if (found) return found;
      }
      if (step.parallelBranches) {
        for (const branch of step.parallelBranches) {
          const found = this.findStepById(id, branch);
          if (found) return found;
        }
      }
      if (step.sequentialSteps) {
        const found = this.findStepById(id, step.sequentialSteps);
        if (found) return found;
      }
    }
    return undefined;
  }
}
