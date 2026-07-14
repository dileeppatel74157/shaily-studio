import { PromptTemplate } from "./PromptTemplate";
import { PromptMetadata } from "./PromptMetadata";
import { PromptCapability } from "./PromptCapability";

export interface PromptSnapshot {
  readonly id: string;
  readonly metadata: PromptMetadata;
  readonly template: PromptTemplate;
  readonly version: string;
  readonly capabilities: readonly PromptCapability[];
  readonly timestamp: Date;
}
