import { IPrompt } from "./IPrompt";
import { PromptTemplate } from "./PromptTemplate";
import { PromptMetadata } from "./PromptMetadata";
import { PromptVersion } from "./PromptVersion";
import { PromptCapability } from "./PromptCapability";
import { PromptSnapshot } from "./PromptSnapshot";
import { PromptRenderer } from "./PromptRenderer";
import { deepFreeze } from "./types";

export class Prompt implements IPrompt {
  private readonly _renderer = new PromptRenderer();

  constructor(
    public readonly template: PromptTemplate,
    public readonly metadata: PromptMetadata,
    public readonly version: PromptVersion,
    public readonly capabilities: readonly PromptCapability[]
  ) {
    deepFreeze(this.template);
    deepFreeze(this.metadata);
    deepFreeze(this.version);
    deepFreeze(this.capabilities);
  }

  public render(variables: Record<string, unknown>): string {
    return this._renderer.render(
      this.template.content,
      variables,
      this.template.variables
    );
  }

  public snapshot(): PromptSnapshot {
    return deepFreeze({
      id: this.metadata.id,
      metadata: this.metadata,
      template: this.template,
      version: this.version.toString(),
      capabilities: this.capabilities,
      timestamp: new Date(),
    });
  }
}
