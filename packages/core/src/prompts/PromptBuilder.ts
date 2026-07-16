import { IPromptRegistry } from "./IPromptRegistry";
import { PromptRegistry } from "./PromptRegistry";
import { PromptContext } from "./PromptContext";
import { PromptValidator } from "./PromptValidator";
import { PromptRenderer } from "./PromptRenderer";
import { IAIEngine } from "../ai/IAIEngine";
import { ISecurity } from "../security/ISecurity";
import { IObservability } from "../observability/IObservability";
import { IMessageBus } from "../messagebus/IMessageBus";
import { ILogger } from "../logger/ILogger";
import { PromptValidationException } from "./types";

// Legacy imports
import { Prompt } from "./Prompt";
import { IPrompt } from "./IPrompt";
import { PromptTemplate } from "./PromptTemplate";
import { PromptMetadata } from "./PromptMetadata";
import { PromptVersion } from "./PromptVersion";
import { PromptCapability } from "./PromptCapability";
import { PromptVariable } from "./PromptVariable";
import { PromptCategory } from "./PromptCategory";

export class PromptBuilder {
  // New builder properties
  private _context?: PromptContext;
  private _aiEngine?: IAIEngine;
  private _security?: ISecurity;
  private _observability?: IObservability;
  private _messageBus?: IMessageBus;
  private _logger?: ILogger;

  // Legacy/Single prompt builder properties
  private _id?: string;
  private _name?: string;
  private _version?: string;
  private _templateContent?: string;
  private _description?: string;
  private _author = "System";
  private readonly _variables: PromptVariable[] = [];
  private readonly _capabilities: PromptCapability[] = [];
  private _metadata: Record<string, any> = {};

  // New builder methods
  public withContext(context: PromptContext): this {
    this._context = context;
    return this;
  }

  public withAIEngine(aiEngine: IAIEngine): this {
    this._aiEngine = aiEngine;
    return this;
  }

  public withSecurity(security: ISecurity): this {
    this._security = security;
    return this;
  }

  public withObservability(observability: IObservability): this {
    this._observability = observability;
    return this;
  }

  public withMessageBus(messageBus: IMessageBus): this {
    this._messageBus = messageBus;
    return this;
  }

  public withLogger(logger: ILogger): this {
    this._logger = logger;
    return this;
  }

  // Legacy builder methods
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

  public withTemplate(content: string): this {
    this._templateContent = content;
    return this;
  }

  public withDescription(description: string): this {
    this._description = description;
    return this;
  }

  public withAuthor(author: string): this {
    this._author = author;
    return this;
  }

  public withVariable(
    name: string,
    description: string,
    required = true,
    defaultValue?: any
  ): this {
    this._variables.push({
      name,
      type: "string",
      required,
      defaultValue,
      description,
    });
    return this;
  }

  public withVariables(variables: readonly PromptVariable[]): this {
    this._variables.push(...variables);
    return this;
  }

  public withCapability(capability: PromptCapability): this {
    this._capabilities.push(capability);
    return this;
  }

  public withCapabilities(capabilities: readonly PromptCapability[]): this {
    this._capabilities.push(...capabilities);
    return this;
  }

  public withMetadata(metadata: Record<string, any>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  // Unified Build method
  public build(): any {
    const hasLegacyFields = !!(
      this._id ||
      this._name ||
      this._templateContent ||
      this._variables.length > 0 ||
      this._capabilities.length > 0
    );

    if (this._context || !hasLegacyFields) {
      // Build PromptRegistry (new behavior)
      if (!this._context) {
        throw new PromptValidationException("PromptContext cannot be null or undefined.");
      }

      let finalAIEngine = this._aiEngine;
      let finalSecurity = this._security;
      let finalObservability = this._observability;
      let finalMessageBus = this._messageBus;
      let finalLogger = this._logger;
      let env: string | undefined;
      let namespace: string | undefined;
      let contextMetadata = {};

      if (this._context) {
        finalAIEngine = finalAIEngine || this._context.aiEngine;
        finalSecurity = finalSecurity || this._context.security;
        finalObservability = finalObservability || this._context.observability;
        finalMessageBus = finalMessageBus || this._context.messageBus;
        finalLogger = finalLogger || this._context.logger;
        env = this._context.env;
        namespace = this._context.namespace;
        contextMetadata = this._context.metadata || {};
      }

      const context: PromptContext = {
        env,
        namespace,
        logger: finalLogger,
        aiEngine: finalAIEngine,
        security: finalSecurity,
        observability: finalObservability,
        messageBus: finalMessageBus,
        metadata: { ...contextMetadata, ...this._metadata },
      };

      PromptValidator.validateContext(context);

      return new PromptRegistry(context, this._metadata);
    } else {
      // Build Prompt (legacy behavior)
      const parsedVersion = PromptVersion.parse(this._version || "1.0.0");

      const metadata: PromptMetadata = {
        author: this._author,
        priority: 1,
        ...this._metadata,
      };

      const template: PromptTemplate = {
        id: this._id || "",
        name: this._name || "",
        description: this._description || "",
        category: PromptCategory.CUSTOM,
        version: this._version || "1.0.0",
        variables: [...this._variables],
        metadata,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        enabled: true,
        content: this._templateContent || "",
      };

      // Define render property directly on the template object so that get() returns a template with render
      const renderedTemplate = {
        ...template,
        render: (variables: Record<string, unknown>) => {
          return PromptRenderer.renderLegacy(template.content || "", variables, template.variables);
        }
      };

      return new Prompt(
        renderedTemplate,
        metadata,
        parsedVersion,
        [...this._capabilities]
      );
    }
  }
}
