import { ConfigurationSnapshot, ValidationReport, ValidationIssue } from "./models";
import { ValidationResult } from "./ValidationResult";
import { ConfigurationState } from "./ConfigurationState";
import { ConfigurationValidationException } from "./types";

export class ConfigurationValidator {
  public async validate(snapshot: ConfigurationSnapshot): Promise<ValidationReport> {
    const issues: ValidationIssue[] = [];

    // 1-3. Environment variables checks
    const variables = snapshot.environment.variables;
    if (!variables["NODE_ENV"]) {
      issues.push({ key: "NODE_ENV", message: "NODE_ENV is missing.", severity: "warning" });
    }
    if (!variables["PORT"]) {
      issues.push({ key: "PORT", message: "PORT is missing.", severity: "error" });
    }

    // 4-6. Runtime ports & host check
    const runtime = snapshot.runtime;
    if (runtime.port <= 0 || runtime.port > 65535) {
      issues.push({ key: "runtime.port", message: "Runtime port is invalid (must be between 1 and 65535).", severity: "error" });
    }
    if (!runtime.host) {
      issues.push({ key: "runtime.host", message: "Runtime host is empty.", severity: "error" });
    }

    // 7-12. Provider configuration validations
    const seenProviders = new Set<string>();
    snapshot.providers.forEach((prov, idx) => {
      if (seenProviders.has(prov.id)) {
        issues.push({ key: `providers[${idx}].id`, message: `Duplicate provider config for: ${prov.id}`, severity: "error" });
      }
      seenProviders.add(prov.id);

      if (prov.timeoutMs < 0) {
        issues.push({ key: `providers[${idx}].timeoutMs`, message: `Timeout cannot be negative for: ${prov.id}`, severity: "error" });
      }
      if (prov.retryLimit < 0 || prov.retryLimit > 20) {
        issues.push({ key: `providers[${idx}].retryLimit`, message: `Retry limit must be between 0 and 20 for: ${prov.id}`, severity: "error" });
      }
      if (prov.rateLimitPerMinute <= 0) {
        issues.push({ key: `providers[${idx}].rateLimitPerMinute`, message: `Rate limit must be positive for: ${prov.id}`, severity: "warning" });
      }
      if (!prov.defaultModel) {
        issues.push({ key: `providers[${idx}].defaultModel`, message: `Default model is empty for: ${prov.id}`, severity: "warning" });
      }
    });

    const hasErrors = issues.some(issue => issue.severity === "error");
    const result = hasErrors
      ? ValidationResult.FAILED
      : issues.length > 0 ? ValidationResult.WARNING : ValidationResult.PASSED;

    return {
      timestamp: new Date(),
      result,
      issues
    };
  }

  // 13-17. Credentials & Key format validations
  public validateApiKeyFormat(providerId: string, value: string): void {
    if (providerId === "openai" && !value.startsWith("sk-")) {
      throw new ConfigurationValidationException("OpenAI API key must start with 'sk-'.");
    }
    if (providerId === "gemini" && !value.startsWith("AIzaSy")) {
      throw new ConfigurationValidationException("Gemini API key must start with 'AIzaSy'.");
    }
  }

  // 18-20. State transition rule checking
  public validateStateTransition(current: ConfigurationState, next: ConfigurationState): void {
    const validTransitions: Record<ConfigurationState, ConfigurationState[]> = {
      [ConfigurationState.CREATED]: [ConfigurationState.LOADING, ConfigurationState.FAILED],
      [ConfigurationState.LOADING]: [ConfigurationState.VALIDATING, ConfigurationState.FAILED],
      [ConfigurationState.VALIDATING]: [ConfigurationState.READY, ConfigurationState.FAILED],
      [ConfigurationState.READY]: [ConfigurationState.UPDATING, ConfigurationState.FAILED],
      [ConfigurationState.UPDATING]: [ConfigurationState.READY, ConfigurationState.FAILED],
      [ConfigurationState.FAILED]: [ConfigurationState.LOADING]
    };

    if (!validTransitions[current]?.includes(next)) {
      throw new ConfigurationValidationException(`Invalid configuration state transition: ${current} -> ${next}`);
    }
  }
}
