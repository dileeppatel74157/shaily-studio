import { PromptTemplate } from "./PromptTemplate";
import { PromptMetadata } from "./PromptMetadata";
import { PromptVersion } from "./PromptVersion";
import { PromptCapability } from "./PromptCapability";
import { PromptSnapshot } from "./PromptSnapshot";

export interface IPrompt {
  readonly template: PromptTemplate;
  readonly metadata: PromptMetadata;
  readonly version: PromptVersion;
  readonly capabilities: readonly PromptCapability[];

  render(variables: Record<string, unknown>): string;
  snapshot(): PromptSnapshot;
}
