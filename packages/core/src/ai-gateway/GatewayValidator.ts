import { GatewaySnapshot } from "./models";
import { GatewayValidationException } from "./types";
import { CircuitBreakerState } from "./CircuitBreakerState";

export class GatewayValidator {
  validate(snapshot: GatewaySnapshot): void {
    const cfg = snapshot.configuration;

    // 1. Configuration must have environment set
    if (!cfg.environment || cfg.environment.trim() === "") {
      throw new GatewayValidationException("Gateway configuration must specify an environment.");
    }

    // 2. Timeout must be between 100ms and 120,000ms
    if (cfg.defaultTimeoutMs < 100 || cfg.defaultTimeoutMs > 120_000) {
      throw new GatewayValidationException(
        `defaultTimeoutMs must be between 100 and 120000, got ${cfg.defaultTimeoutMs}.`
      );
    }

    // 3. Max retries must be 0–10
    if (cfg.maxRetries < 0 || cfg.maxRetries > 10) {
      throw new GatewayValidationException(
        `maxRetries must be between 0 and 10, got ${cfg.maxRetries}.`
      );
    }

    // 4. Routing strategy must be set
    if (!cfg.routingStrategy) {
      throw new GatewayValidationException("routingStrategy must be specified in gateway configuration.");
    }

    // 5. Retry policy must be set
    if (!cfg.retryPolicy) {
      throw new GatewayValidationException("retryPolicy must be specified in gateway configuration.");
    }

    // 6. Circuit breaker threshold must be 1–100
    if (cfg.circuitBreakerThreshold < 1 || cfg.circuitBreakerThreshold > 100) {
      throw new GatewayValidationException(
        `circuitBreakerThreshold must be between 1 and 100, got ${cfg.circuitBreakerThreshold}.`
      );
    }
  }

  validateRequest(requestId: string, prompt: string, model: string): void {
    // 7. Request must include a non-empty prompt
    if (!prompt || prompt.trim() === "") {
      throw new GatewayValidationException(`Request "${requestId}" must include a non-empty prompt.`);
    }

    // 8. Model must be a non-empty string
    if (!model || model.trim() === "") {
      throw new GatewayValidationException(`Request "${requestId}" must include a non-empty model.`);
    }

    // 9. Request ID must be non-empty
    if (!requestId || requestId.trim() === "") {
      throw new GatewayValidationException("Request must have a valid non-empty requestId.");
    }
  }

  validateCredential(apiKey: string | undefined, providerId: string): void {
    // 10. API key must not be empty
    if (!apiKey || apiKey.trim() === "") {
      throw new GatewayValidationException(
        `API key for provider "${providerId}" must not be empty.`
      );
    }
  }

  validateCircuitBreaker(failures: number, threshold: number, state: CircuitBreakerState): void {
    // 11. Consecutive failures must not exceed threshold when circuit is CLOSED
    if (state === CircuitBreakerState.CLOSED && failures > threshold) {
      throw new GatewayValidationException(
        `Provider has ${failures} consecutive failures exceeding threshold ${threshold} while circuit is CLOSED.`
      );
    }
  }

  validateUsageRecord(costUsd: number, requestId: string): void {
    // 12. Usage record must have a non-negative cost
    if (costUsd < 0) {
      throw new GatewayValidationException(
        `Usage record for request "${requestId}" has negative cost: ${costUsd}.`
      );
    }
  }

  validateRetryAttempt(attemptNumber: number): void {
    // 13. Retry attempt number must be >= 1
    if (attemptNumber < 1) {
      throw new GatewayValidationException(`Retry attempt number must be >= 1, got ${attemptNumber}.`);
    }
  }

  validateBackoffDelay(delayMs: number): void {
    // 14. Backoff delay must not exceed 60 seconds
    if (delayMs > 60_000) {
      throw new GatewayValidationException(
        `Backoff delay ${delayMs}ms exceeds maximum allowed 60000ms.`
      );
    }
  }

  validateRouteDecision(selectedProviderId: string): void {
    // 15. Route decision must include a selected provider
    if (!selectedProviderId || selectedProviderId.trim() === "") {
      throw new GatewayValidationException("Route decision must include a selected providerId.");
    }
  }

  validateRateLimit(requestsPerMinute: number): void {
    // 16. Rate limit threshold must be positive
    if (requestsPerMinute <= 0) {
      throw new GatewayValidationException(
        `requestsPerMinute must be positive, got ${requestsPerMinute}.`
      );
    }
  }

  validateDailyQuota(requestLimit: number, tokenLimit: number): void {
    // 17. Daily quota must be positive
    if (requestLimit <= 0 || tokenLimit <= 0) {
      throw new GatewayValidationException(
        "Daily quota requestLimit and tokenLimit must be positive."
      );
    }
  }

  validateTokenExpiry(expiresAt: Date | undefined): void {
    // 18. Auth credential must not have an expired token
    if (expiresAt && expiresAt < new Date()) {
      throw new GatewayValidationException(
        `Auth credential token expired at ${expiresAt.toISOString()}.`
      );
    }
  }

  validateStreamingResponse(requestId: string): void {
    // 19. Streaming responses must include a requestId
    if (!requestId || requestId.trim() === "") {
      throw new GatewayValidationException("Streaming response must include a non-empty requestId.");
    }
  }

  validateCost(cost: number): void {
    // 20. Cost calculation must produce a non-negative value
    if (cost < 0) {
      throw new GatewayValidationException(`Cost calculation produced a negative value: ${cost}.`);
    }
  }
}
