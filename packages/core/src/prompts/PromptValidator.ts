import { PromptMetadata } from "./PromptMetadata";
import { PromptVariable } from "./PromptVariable";
import { PromptValidationException } from "./types";

export class PromptValidator {
  public validateMetadata(metadata: PromptMetadata): void {
    if (!metadata.id || metadata.id.trim() === "") {
      throw new PromptValidationException("Prompt ID cannot be empty.");
    }
    if (!metadata.name || metadata.name.trim() === "") {
      throw new PromptValidationException("Prompt Name cannot be empty.");
    }
    if (!metadata.description || metadata.description.trim() === "") {
      throw new PromptValidationException("Prompt Description cannot be empty.");
    }
    if (!metadata.author || metadata.author.trim() === "") {
      throw new PromptValidationException("Prompt Author cannot be empty.");
    }
  }

  public validateVariables(variables: readonly PromptVariable[]): void {
    const seen = new Set<string>();
    const varNamePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

    for (const v of variables) {
      if (!v.name || v.name.trim() === "") {
        throw new PromptValidationException("Variable name cannot be empty.");
      }
      if (!varNamePattern.test(v.name)) {
        throw new PromptValidationException(
          `Invalid variable name: "${v.name}". Variable names must start with a letter or underscore and contain only alphanumeric characters and underscores.`
        );
      }
      if (seen.has(v.name)) {
        throw new PromptValidationException(`Duplicate variable definition: "${v.name}".`);
      }
      seen.add(v.name);
    }
  }

  public validateTemplate(content: string, variables: readonly PromptVariable[]): void {
    if (!content || content.trim() === "") {
      throw new PromptValidationException("Template content cannot be empty.");
    }

    let index = 0;
    const placeholders: string[] = [];

    while (index < content.length) {
      const openIdx = content.indexOf("{{", index);
      if (openIdx === -1) {
        break;
      }

      const closeIdx = content.indexOf("}}", openIdx);
      if (closeIdx === -1) {
        throw new PromptValidationException(
          "Invalid template: Unclosed variable placeholder brackets '{{'."
        );
      }

      const nextOpenIdx = content.indexOf("{{", openIdx + 2);
      if (nextOpenIdx !== -1 && nextOpenIdx < closeIdx) {
        throw new PromptValidationException(
          "Invalid template: Mismatched or nested variable placeholder brackets '{{'."
        );
      }

      const varName = content.slice(openIdx + 2, closeIdx).trim();
      if (varName === "") {
        throw new PromptValidationException("Invalid template: Empty variable placeholder found.");
      }
      placeholders.push(varName);
      index = closeIdx + 2;
    }

    const definedVarNames = new Set(variables.map((v) => v.name));
    for (const name of placeholders) {
      if (!definedVarNames.has(name)) {
        throw new PromptValidationException(
          `Invalid template: Variable "${name}" is referenced in the template but not defined in variables.`
        );
      }
    }
  }
}
