import { ExecutionSnapshot } from "./models";
import { ExecutionValidationException } from "./types";

export class ExecutionValidator {
  validate(snapshot: ExecutionSnapshot): void {
    const cfg = snapshot.configuration;

    // 1. Environment must be set
    if (!cfg.environment || cfg.environment.trim() === "") {
      throw new ExecutionValidationException("Execution configuration must specify an environment.");
    }

    // 2. Daily budget must be positive
    if (cfg.dailyBudgetUsd <= 0) {
      throw new ExecutionValidationException(`dailyBudgetUsd must be positive, got ${cfg.dailyBudgetUsd}.`);
    }

    // 3. Monthly budget must be >= daily budget
    if (cfg.monthlyBudgetUsd < cfg.dailyBudgetUsd) {
      throw new ExecutionValidationException(
        `monthlyBudgetUsd (${cfg.monthlyBudgetUsd}) must be >= dailyBudgetUsd (${cfg.dailyBudgetUsd}).`
      );
    }

    // 4. Emergency stop threshold must be positive
    if (cfg.emergencyStopThresholdUsd <= 0) {
      throw new ExecutionValidationException(
        `emergencyStopThresholdUsd must be positive, got ${cfg.emergencyStopThresholdUsd}.`
      );
    }

    // 5. Emergency stop threshold must not exceed monthly budget
    if (cfg.emergencyStopThresholdUsd > cfg.monthlyBudgetUsd) {
      throw new ExecutionValidationException(
        `emergencyStopThresholdUsd (${cfg.emergencyStopThresholdUsd}) must not exceed monthlyBudgetUsd (${cfg.monthlyBudgetUsd}).`
      );
    }

    // 6. Max parallel requests must be between 1 and 50
    if (cfg.maxParallelRequests < 1 || cfg.maxParallelRequests > 50) {
      throw new ExecutionValidationException(
        `maxParallelRequests must be between 1 and 50, got ${cfg.maxParallelRequests}.`
      );
    }

    // 7. Cache max size must be positive
    if (cfg.cacheMaxSizeMb <= 0) {
      throw new ExecutionValidationException(`cacheMaxSizeMb must be positive, got ${cfg.cacheMaxSizeMb}.`);
    }

    // 8. Cache TTL must be positive
    if (cfg.cacheTtlSeconds <= 0) {
      throw new ExecutionValidationException(`cacheTtlSeconds must be positive, got ${cfg.cacheTtlSeconds}.`);
    }
  }

  validateRequest(requestId: string, prompt: string): void {
    // 9. Request ID must be non-empty
    if (!requestId || requestId.trim() === "") {
      throw new ExecutionValidationException("ExecutionRequest must have a non-empty requestId.");
    }

    // 10. Prompt must be non-empty
    if (!prompt || prompt.trim() === "") {
      throw new ExecutionValidationException(`Request "${requestId}" must include a non-empty prompt.`);
    }
  }

  validateBatchSize(size: number): void {
    // 11. Batch must contain at least 1 request
    if (size < 1) {
      throw new ExecutionValidationException("Batch must contain at least 1 request.");
    }

    // 12. Batch must not exceed 100 requests
    if (size > 100) {
      throw new ExecutionValidationException(`Batch size ${size} exceeds the limit of 100 requests.`);
    }
  }

  validateTokenEstimate(estimatedTokens: number): void {
    // 13. Token estimate must be positive
    if (estimatedTokens <= 0) {
      throw new ExecutionValidationException(`Token estimate must be positive, got ${estimatedTokens}.`);
    }
  }

  validateCostEstimate(costUsd: number, requestId: string): void {
    // 14. Cost estimate must be non-negative
    if (costUsd < 0) {
      throw new ExecutionValidationException(
        `Cost estimate for request "${requestId}" must be non-negative, got ${costUsd}.`
      );
    }
  }

  validateQualityScore(score: number): void {
    // 15. Quality score must be between 0 and 100
    if (score < 0 || score > 100) {
      throw new ExecutionValidationException(`Quality score must be between 0 and 100, got ${score}.`);
    }
  }

  validateProviderScore(compositeScore: number, providerId: string): void {
    // 16. Composite score must be between 0 and 100
    if (compositeScore < 0 || compositeScore > 100) {
      throw new ExecutionValidationException(
        `Provider "${providerId}" composite score ${compositeScore} must be 0–100.`
      );
    }
  }

  validateCacheKey(key: string): void {
    // 17. Cache key must be non-empty
    if (!key || key.trim() === "") {
      throw new ExecutionValidationException("Cache key must be a non-empty string.");
    }
  }

  validateCacheTtl(ttlSeconds: number): void {
    // 18. Cache TTL must be positive
    if (ttlSeconds <= 0) {
      throw new ExecutionValidationException(`Cache TTL must be positive seconds, got ${ttlSeconds}.`);
    }
  }

  validateBudgetRule(maxCostPerRequest: number, requireApprovalAbove: number): void {
    // 19. Require approval threshold must not exceed max cost per request
    if (requireApprovalAbove > maxCostPerRequest) {
      throw new ExecutionValidationException(
        `requireApprovalAboveUsd (${requireApprovalAbove}) must not exceed maxCostPerRequestUsd (${maxCostPerRequest}).`
      );
    }
  }

  validateLatency(latencyMs: number, requestId: string): void {
    // 20. Latency must be non-negative
    if (latencyMs < 0) {
      throw new ExecutionValidationException(
        `Latency for request "${requestId}" must be non-negative, got ${latencyMs}.`
      );
    }
  }
}
