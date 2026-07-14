import { IPrompt } from "./IPrompt";
import { PromptSnapshot } from "./PromptSnapshot";
import { PromptValidationException, deepFreeze } from "./types";

export interface PromptRegistrySnapshot {
  readonly promptsCount: number;
  readonly prompts: readonly PromptSnapshot[];
}

export class PromptRegistry {
  private readonly _prompts = new Map<string, IPrompt>();

  public register(prompt: IPrompt): void {
    const snap = prompt.snapshot();
    if (this._prompts.has(snap.id)) {
      throw new PromptValidationException(
        `Prompt with ID "${snap.id}" is already registered.`
      );
    }
    this._prompts.set(snap.id, prompt);
  }

  public unregister(id: string): boolean {
    return this._prompts.delete(id);
  }

  public get(id: string): IPrompt | undefined {
    return this._prompts.get(id);
  }

  public has(id: string): boolean {
    return this._prompts.has(id);
  }

  public render(id: string, variables: Record<string, unknown>): string {
    const prompt = this._prompts.get(id);
    if (!prompt) {
      throw new PromptValidationException(`Prompt with ID "${id}" is not registered.`);
    }
    return prompt.render(variables);
  }

  public snapshot(): PromptRegistrySnapshot {
    const snaps = Array.from(this._prompts.values()).map((p) => p.snapshot());
    return deepFreeze({
      promptsCount: snaps.length,
      prompts: snaps,
    });
  }
}
