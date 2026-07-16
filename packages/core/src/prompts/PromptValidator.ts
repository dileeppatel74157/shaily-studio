import { PromptTemplate } from "./PromptTemplate";
import { PromptVariable } from "./PromptVariable";
import { PromptContext } from "./PromptContext";
import { PromptValidationException } from "./types";

export class PromptValidator {
  public static validateContext(context: PromptContext): void {
    if (!context) {
      throw new PromptValidationException("PromptContext cannot be null or undefined.");
    }
  }

  public static validateTemplate(template: PromptTemplate): void {
    if (!template) {
      throw new PromptValidationException("PromptTemplate cannot be null or undefined.");
    }
    if (!template.id || !template.id.trim()) {
      throw new PromptValidationException("Prompt template ID cannot be empty.");
    }
    if (!template.name || !template.name.trim()) {
      throw new PromptValidationException("Prompt template name cannot be empty.");
    }
    if (!template.version || !template.version.trim()) {
      throw new PromptValidationException("Prompt template version cannot be empty.");
    }

    // Version format check: semver-like (e.g. X.Y.Z)
    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
    if (!semverRegex.test(template.version)) {
      throw new PromptValidationException(`invalid versions: Prompt template version "${template.version}" is invalid.`);
    }

    // Empty prompts: at least one segment must exist and not be empty
    const hasSystem = !!template.systemPrompt?.trim();
    const hasDeveloper = !!template.developerPrompt?.trim();
    const hasUser = !!template.userPrompt?.trim();
    const hasContent = !!template.content?.trim();
    if (!hasSystem && !hasDeveloper && !hasUser && !hasContent) {
      throw new PromptValidationException("empty prompts: Prompt template must specify at least systemPrompt, developerPrompt, userPrompt, or content.");
    }

    // Duplicate variables: variable names must be unique
    const varNames = new Set<string>();
    for (const v of template.variables) {
      if (!v.name || !v.name.trim()) {
        throw new PromptValidationException("Variable name cannot be empty.");
      }
      if (varNames.has(v.name)) {
        throw new PromptValidationException(`duplicate variables: Variable "${v.name}" is declared more than once.`);
      }
      varNames.add(v.name);
    }

    // Invalid placeholders check: segments must only reference declared variables
    const checkPlaceholders = (promptText?: string) => {
      if (!promptText) return;
      const placeholders = promptText.match(/\{\{([a-zA-Z0-9_]+)\}\}/g);
      if (placeholders) {
        for (const p of placeholders) {
          const varName = p.slice(2, -2);
          if (!varNames.has(varName)) {
            throw new PromptValidationException(
              `invalid placeholders: Placeholder "${p}" in prompt segment references undeclared variable.`
            );
          }
        }
      }
    };
    checkPlaceholders(template.systemPrompt);
    checkPlaceholders(template.developerPrompt);
    checkPlaceholders(template.userPrompt);
    checkPlaceholders(template.content);
  }
}
