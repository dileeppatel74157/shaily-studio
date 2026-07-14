import { PromptVariable } from "./PromptVariable";
import { PromptValidationException } from "./types";

export class PromptRenderer {
  public render(
    content: string,
    variables: Record<string, unknown>,
    definitions: readonly PromptVariable[]
  ): string {
    // Check if required variables are missing
    for (const def of definitions) {
      const isProvided = variables[def.name] !== undefined;
      const hasDefault = def.defaultValue !== undefined;

      if (def.required && !isProvided && !hasDefault) {
        throw new PromptValidationException(`Missing required variable: "${def.name}"`);
      }
    }

    let rendered = content;
    for (const def of definitions) {
      const value = variables[def.name] !== undefined ? variables[def.name] : def.defaultValue;
      const strVal = value !== undefined ? String(value) : "";
      
      const placeholder = `{{${def.name}}}`;
      rendered = rendered.split(placeholder).join(strVal);
    }

    return rendered;
  }
}
