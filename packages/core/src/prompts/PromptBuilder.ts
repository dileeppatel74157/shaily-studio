import { Prompt } from "./Prompt";
import { IPrompt } from "./IPrompt";
import { PromptTemplate } from "./PromptTemplate";
import { PromptMetadata } from "./PromptMetadata";
import { PromptVersion } from "./PromptVersion";
import { PromptCapability } from "./PromptCapability";
import { PromptVariable } from "./PromptVariable";
import { PromptValidator } from "./PromptValidator";

export class PromptBuilder {
  private _id?: string;
  private _name?: string;
  private _version?: string;
  private _templateContent?: string;
  private _description?: string;
  private _author = "System";
  private readonly _variables: PromptVariable[] = [];
  private readonly _capabilities: PromptCapability[] = [];
  private _metadata: Record<string, any> = {};

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
    this._variables.push({ name, description, required, defaultValue });
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

  public build(): IPrompt {
    const parsedVersion = PromptVersion.parse(this._version || "1.0.0");

    const metadata: PromptMetadata = {
      id: this._id || "",
      name: this._name || "",
      description: this._description || "",
      author: this._author,
      ...this._metadata,
    };

    const template: PromptTemplate = {
      content: this._templateContent || "",
      variables: Object.freeze([...this._variables]),
    };

    const validator = new PromptValidator();
    validator.validateMetadata(metadata);
    validator.validateVariables(template.variables);
    validator.validateTemplate(template.content, template.variables);

    return new Prompt(
      template,
      metadata,
      parsedVersion,
      Object.freeze([...this._capabilities])
    );
  }
}
