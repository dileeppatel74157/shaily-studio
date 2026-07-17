import { ExecutionSession } from "./ExecutionSession";
import { LimitExceededException, BudgetExceededException } from "./types";

export class ExecutionGuard {
  public static checkLimits(session: ExecutionSession): void {
    const limits = session.policy.limits;
    const metrics = session.metrics;

    if (metrics.totalTokens > limits.maxTokens) {
      throw new LimitExceededException("maxTokens", metrics.totalTokens, limits.maxTokens);
    }
    if (metrics.totalCost > limits.maxCost) {
      throw new LimitExceededException("maxCost", metrics.totalCost, limits.maxCost);
    }
    if (metrics.recursionDepth > limits.maxRecursion) {
      throw new LimitExceededException("maxRecursion", metrics.recursionDepth, limits.maxRecursion);
    }
    if (metrics.aiCallsCount > limits.maxAiCalls) {
      throw new LimitExceededException("maxAiCalls", metrics.aiCallsCount, limits.maxAiCalls);
    }
    if (metrics.toolCallsCount > limits.maxToolCalls) {
      throw new LimitExceededException("maxToolCalls", metrics.toolCallsCount, limits.maxToolCalls);
    }
    if (metrics.retriesCount > limits.maxRetries) {
      throw new LimitExceededException("maxRetries", metrics.retriesCount, limits.maxRetries);
    }

    const duration = Date.now() - metrics.startTime.getTime();
    if (duration > limits.maxExecutionTimeMs) {
      throw new LimitExceededException("maxExecutionTimeMs", duration, limits.maxExecutionTimeMs);
    }
  }

  public static checkBudget(session: ExecutionSession): void {
    const budget = session.policy.budget;
    const metrics = session.metrics;

    if (metrics.totalTokens > budget.tokens) {
      throw new BudgetExceededException("tokens", metrics.totalTokens, budget.tokens);
    }
    if (metrics.totalCost > budget.cost) {
      throw new BudgetExceededException("cost", metrics.totalCost, budget.cost);
    }
  }
}
