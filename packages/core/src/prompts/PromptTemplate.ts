import { PromptCategory } from "./PromptCategory";
import { PromptVariable } from "./PromptVariable";
import { PromptMetadata } from "./PromptMetadata";

export interface PromptTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: PromptCategory;
  readonly version: string;
  readonly systemPrompt?: string;
  readonly developerPrompt?: string;
  readonly userPrompt?: string;
  readonly variables: readonly PromptVariable[];
  readonly metadata: PromptMetadata;
  readonly tags: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly enabled: boolean;

  // Backward compatibility
  readonly content?: string;
  render?(variables: Record<string, unknown>): string;
}
