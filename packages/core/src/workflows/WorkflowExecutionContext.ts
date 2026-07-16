import { WorkflowStepResult } from "./WorkflowStepResult";

export class WorkflowExecutionContext {
  public readonly variables: Record<string, any> = {};
  public readonly stepResults: WorkflowStepResult[] = [];
  public readonly statistics: {
    startTime: Date;
    endTime?: Date;
    aiCallsCount: number;
    tokensUsed: number;
  };
  public readonly historyEvents: { timestamp: Date; event: string; details?: Record<string, any> }[] = [];

  constructor(
    public readonly executionId: string,
    public readonly workflowId: string,
    initialInput?: Record<string, any>
  ) {
    this.statistics = {
      startTime: new Date(),
      aiCallsCount: 0,
      tokensUsed: 0,
    };
    if (initialInput) {
      Object.assign(this.variables, initialInput);
    }
  }

  public getVariable(name: string): any {
    return this.variables[name];
  }

  public setVariable(name: string, value: any): void {
    this.variables[name] = value;
  }

  public addStepResult(result: WorkflowStepResult): void {
    this.stepResults.push(result);
  }

  public logEvent(event: string, details?: Record<string, any>): void {
    this.historyEvents.push({
      timestamp: new Date(),
      event,
      details,
    });
  }

  /**
   * Resolves a value expression (e.g. "$.variables.myVar" or "$.steps.stepId.output.field")
   * If expression is not a path string starting with "$.", it returns the expression itself.
   */
  public resolveExpression(expression: any): any {
    if (typeof expression !== "string" || !expression.startsWith("$.")) {
      return expression;
    }

    const parts = expression.substring(2).split(".");
    let current: any = {
      variables: this.variables,
      steps: this.stepResults.reduce((acc, res) => {
        acc[res.stepId] = {
          output: res.output,
          error: res.error,
          status: res.status,
        };
        return acc;
      }, {} as Record<string, any>),
    };

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[part];
    }
    return current;
  }
}
