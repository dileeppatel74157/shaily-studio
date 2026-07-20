import { ProviderType } from "./ProviderType";
import { ModelCategory } from "./ModelCategory";
import { RequestPriority } from "./RequestPriority";
import { ProviderHealth } from "./ProviderHealth";
import { ProviderState } from "./ProviderState";
import {
  ProviderConfiguration,
  ModelInfo,
  LLMRequest,
  CompletionRequest,
  EmbeddingRequest,
  ProviderSnapshot,
  ProviderRegistration,
  ChatMessage,
  ModelRoutingRule,
  TokenUsage,
  ValidationIssue,
  ProviderValidationReport
} from "./models";
import { LLMProviderValidationException } from "./types";

export class LLMProviderValidator {

  // ─── 1. Provider Configuration Validation ────────────────────────────────────
  public static validateProviderConfig(config: ProviderConfiguration): void {
    if (!config) {
      throw new LLMProviderValidationException("ProviderConfiguration is required.");
    }
    if (!config.provider) {
      throw new LLMProviderValidationException("Provider type is required.");
    }
    if (!config.models || !Array.isArray(config.models) || config.models.length === 0) {
      throw new LLMProviderValidationException(`Provider "${config.provider}" must define at least one model.`);
    }
  }

  // ─── 2. API Key Present Validation ───────────────────────────────────────────
  public static validateApiKey(config: ProviderConfiguration): void {
    // Ollama and Memory providers don't strictly require API keys.
    if (config.provider !== ProviderType.OLLAMA && config.provider !== ProviderType.CUSTOM) {
      if (!config.apiKey || config.apiKey.trim().length === 0) {
        throw new LLMProviderValidationException(`API key is required for provider "${config.provider}".`);
      }
    }
  }

  // ─── 3. Duplicate Provider Detection ──────────────────────────────────────────
  public static validateNoDuplicateProvider(existing: ProviderType[], type: ProviderType): void {
    if (existing.includes(type)) {
      throw new LLMProviderValidationException(`Provider "${type}" is already registered.`);
    }
  }

  // ─── 4. Model Supported Validation ────────────────────────────────────────────
  public static validateModelSupported(registration: ProviderRegistration, model: string): void {
    const supported = registration.config.models.some(m => m.id === model);
    if (!supported) {
      throw new LLMProviderValidationException(
        `Model "${model}" is not supported by provider "${registration.type}".`
      );
    }
  }

  // ─── 5. Request Message / Prompt Non-Empty ────────────────────────────────────
  public static validateMessagesNotEmpty(messages: ChatMessage[]): void {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new LLMProviderValidationException("Messages list must be a non-empty array.");
    }
    for (const msg of messages) {
      if (!msg.content || msg.content.trim().length === 0) {
        throw new LLMProviderValidationException("Message content cannot be empty.");
      }
      if (!msg.role) {
        throw new LLMProviderValidationException("Message role is required.");
      }
    }
  }

  // ─── 6. Prompt Validation (Completion Requests) ──────────────────────────────
  public static validatePromptNotEmpty(prompt: string): void {
    if (!prompt || prompt.trim().length === 0) {
      throw new LLMProviderValidationException("Prompt cannot be empty.");
    }
  }

  // ─── 7. Embedding Input Validation ───────────────────────────────────────────
  public static validateEmbeddingInput(input: string | string[]): void {
    if (!input) {
      throw new LLMProviderValidationException("Embedding input is required.");
    }
    if (Array.isArray(input)) {
      if (input.length === 0) {
        throw new LLMProviderValidationException("Embedding input array cannot be empty.");
      }
      for (const str of input) {
        if (!str || str.trim().length === 0) {
          throw new LLMProviderValidationException("Embedding input string element cannot be empty.");
        }
      }
    } else {
      if (input.trim().length === 0) {
        throw new LLMProviderValidationException("Embedding input string cannot be empty.");
      }
    }
  }

  // ─── 8. Parameter Bounds (Temperature) ────────────────────────────────────────
  public static validateTemperature(temperature?: number): void {
    if (temperature !== undefined) {
      if (temperature < 0.0 || temperature > 2.0) {
        throw new LLMProviderValidationException("Temperature must be between 0.0 and 2.0.");
      }
    }
  }

  // ─── 9. Request Priority Validation ───────────────────────────────────────────
  public static validateRequestPriority(priority?: RequestPriority): void {
    if (priority !== undefined) {
      const valid = Object.values(RequestPriority).includes(priority);
      if (!valid) {
        throw new LLMProviderValidationException(`Invalid RequestPriority: "${priority}".`);
      }
    }
  }

  // ─── 10. Streaming Capability Verification ──────────────────────────────────
  public static validateStreamingCapability(registration: ProviderRegistration, streamRequested?: boolean): void {
    if (streamRequested && !registration.capabilities.supportsStreaming) {
      throw new LLMProviderValidationException(
        `Streaming is requested but not supported by provider "${registration.type}".`
      );
    }
  }

  // ─── 11. Embedding Capability Verification ──────────────────────────────────
  public static validateEmbeddingCapability(registration: ProviderRegistration): void {
    if (!registration.capabilities.supportsEmbeddings) {
      throw new LLMProviderValidationException(
        `Embeddings generation is not supported by provider "${registration.type}".`
      );
    }
  }

  // ─── 12. Model Info Validity ──────────────────────────────────────────────────
  public static validateModelInfo(model: ModelInfo): void {
    if (!model.id || model.id.trim().length === 0) {
      throw new LLMProviderValidationException("Model ID is required.");
    }
    if (!model.name || model.name.trim().length === 0) {
      throw new LLMProviderValidationException("Model Name is required.");
    }
    if (model.maxContextTokens <= 0) {
      throw new LLMProviderValidationException("Model maxContextTokens must be greater than 0.");
    }
    if (model.maxOutputTokens <= 0 && model.category !== ModelCategory.EMBEDDING) {
      throw new LLMProviderValidationException("Model maxOutputTokens must be greater than 0.");
    }
  }

  // ─── 13. TokenUsage Counts Validation ─────────────────────────────────────────
  public static validateTokenUsage(usage: TokenUsage): void {
    if (usage.promptTokens < 0 || usage.completionTokens < 0 || usage.totalTokens < 0) {
      throw new LLMProviderValidationException("TokenUsage counts cannot be negative.");
    }
  }

  // ─── 14. Fallback Config Validation ───────────────────────────────────────────
  public static validateFallbackConfig(config: ProviderConfiguration): void {
    if (config.fallbackConfig) {
      const fb = config.fallbackConfig;
      if (!fb.fallbackProviders || fb.fallbackProviders.length === 0) {
        throw new LLMProviderValidationException("Fallback config requires at least one fallback provider.");
      }
      if (!fb.fallbackModels || fb.fallbackModels.length === 0) {
        throw new LLMProviderValidationException("Fallback config requires at least one fallback model.");
      }
    }
  }

  // ─── 15. Routing Rules Validation ─────────────────────────────────────────────
  public static validateRoutingRule(rule: ModelRoutingRule): void {
    if (!rule.pattern || rule.pattern.trim().length === 0) {
      throw new LLMProviderValidationException("Routing rule pattern cannot be empty.");
    }
    if (!rule.targetProvider) {
      throw new LLMProviderValidationException("Routing rule targetProvider is required.");
    }
    if (!rule.targetModel || rule.targetModel.trim().length === 0) {
      throw new LLMProviderValidationException("Routing rule targetModel is required.");
    }
  }

  // ─── 16. Endpoint Format Validation ───────────────────────────────────────────
  public static validateEndpointUrl(endpoint?: string): void {
    if (endpoint) {
      try {
        new URL(endpoint);
      } catch {
        throw new LLMProviderValidationException(`Invalid endpoint URL: "${endpoint}".`);
      }
    }
  }

  // ─── 17. Snapshot Immutability Verification ──────────────────────────────────
  public static validateSnapshotImmutability(snapshot: ProviderSnapshot): void {
    if (!snapshot) {
      throw new LLMProviderValidationException("ProviderSnapshot is required.");
    }
    if (!snapshot.timestamp) {
      throw new LLMProviderValidationException("ProviderSnapshot.timestamp is required.");
    }
  }

  // ─── 18. ModelCategory Validation ────────────────────────────────────────────
  public static validateModelCategory(category: ModelCategory): void {
    const valid = Object.values(ModelCategory).includes(category);
    if (!valid) {
      throw new LLMProviderValidationException(`Invalid ModelCategory: "${category}".`);
    }
  }

  // ─── 19. Context Verification ────────────────────────────────────────────────
  public static validateContext(context: any): void {
    if (!context) {
      throw new LLMProviderValidationException("Context is required.");
    }
    if (typeof context.env !== "string" || !context.env) {
      throw new LLMProviderValidationException("Context env must be a non-empty string.");
    }
    if (typeof context.namespace !== "string" || !context.namespace) {
      throw new LLMProviderValidationException("Context namespace must be a non-empty string.");
    }
  }

  // ─── 20. Provider Registration Validation ─────────────────────────────────────
  public static validateProviderRegistration(reg: ProviderRegistration): void {
    if (!reg.id) {
      throw new LLMProviderValidationException("Provider registration ID is required.");
    }
    if (!reg.type) {
      throw new LLMProviderValidationException("Provider registration type is required.");
    }
    if (!Object.values(ProviderState).includes(reg.state)) {
      throw new LLMProviderValidationException(`Invalid ProviderState: "${reg.state}".`);
    }
    if (!Object.values(ProviderHealth).includes(reg.health)) {
      throw new LLMProviderValidationException(`Invalid ProviderHealth: "${reg.health}".`);
    }
  }

  // ─── Comprehensive Report Generator ──────────────────────────────────────────
  public static generateReport(config: ProviderConfiguration): ProviderValidationReport {
    const issues: ValidationIssue[] = [];

    const runCheck = (rule: string, severity: "ERROR" | "WARNING", fn: () => void) => {
      try {
        fn();
      } catch (err: any) {
        issues.push({
          rule,
          severity,
          message: err.message,
          context: { provider: config.provider }
        });
      }
    };

    runCheck("provider-config", "ERROR", () => LLMProviderValidator.validateProviderConfig(config));
    runCheck("api-key", "ERROR", () => LLMProviderValidator.validateApiKey(config));
    runCheck("endpoint-url", "ERROR", () => LLMProviderValidator.validateEndpointUrl(config.endpoint));
    runCheck("fallback-config", "ERROR", () => LLMProviderValidator.validateFallbackConfig(config));

    if (config.models) {
      for (const m of config.models) {
        runCheck(`model-info-${m.id}`, "ERROR", () => LLMProviderValidator.validateModelInfo(m));
      }
    }

    return {
      timestamp: new Date(),
      valid: issues.every(i => i.severity !== "ERROR"),
      issues
    };
  }
}
