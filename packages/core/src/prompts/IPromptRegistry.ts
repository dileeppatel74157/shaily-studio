import { IPrompt } from "./IPrompt";
import { PromptRegistrySnapshot } from "./PromptRegistry";

export interface IPromptRegistry {
  register(prompt: IPrompt): void;
  unregister(id: string): boolean;
  get(id: string): IPrompt | undefined;
  has(id: string): boolean;
  render(id: string, variables: Record<string, unknown>): string;
  snapshot(): PromptRegistrySnapshot;
}
