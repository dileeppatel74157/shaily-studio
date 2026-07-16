import { IPrompt } from "./IPrompt";
import { PromptTemplate } from "./PromptTemplate";
import { PromptMetadata } from "./PromptMetadata";
import { PromptVersion } from "./PromptVersion";
import { PromptCapability } from "./PromptCapability";
import { PromptSnapshot } from "./PromptSnapshot";
import { PromptRenderer } from "./PromptRenderer";
import { deepFreeze } from "./types";

export class Prompt implements IPrompt {
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
    if (this.template.content !== undefined) {
      return PromptRenderer.renderLegacy(this.template.content, variables, this.template.variables);
    }
    const execution = PromptRenderer.render(this.template, variables);
    return execution.userPrompt || execution.systemPrompt || execution.developerPrompt || "";
  }

  public snapshot(): PromptSnapshot {
    return deepFreeze({
      id: this.metadata.author || "legacy-prompt",
      state: (this.template as any).enabled ? "RUNNING" : "STOPPED",
      templateCount: 1,
      renderedCount: 0,
      metadata: { ...this.metadata } as any,
      timestamp: new Date(),
      // old snapshot compatibility
      version: this.version.toString(),
      capabilities: this.capabilities,
      template: this.template,
    } as any);
  }
}
