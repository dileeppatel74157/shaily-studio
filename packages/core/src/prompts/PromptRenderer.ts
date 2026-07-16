import { PromptTemplate } from "./PromptTemplate";
import { PromptExecution } from "./PromptExecution";
import { PromptValidationException } from "./types";

export class PromptRenderer {
  public static render(
    template: PromptTemplate,
    variables: Record<string, unknown> = {}
  ): PromptExecution {
    const finalVars: Record<string, any> = {};

    // 1. Variable type coercion and validation
    for (const v of template.variables) {
      let val = variables[v.name];

      // Handle missing required variables
      if (val === undefined || val === null) {
        if (v.required) {
          if (v.defaultValue !== undefined) {
            val = v.defaultValue;
          } else {
            throw new PromptValidationException(
              `missing required variables: Variable "${v.name}" is required but not provided.`
            );
          }
        } else {
          val = v.defaultValue !== undefined ? v.defaultValue : "";
        }
      }

      // Check variable type constraints
      if (val !== undefined && val !== "") {
        if (v.type === "string" && typeof val !== "string") {
          val = String(val);
        } else if (v.type === "number" && typeof val !== "number") {
          const parsed = Number(val);
          if (isNaN(parsed)) {
            throw new PromptValidationException(`Variable "${v.name}" must be a number.`);
          }
          val = parsed;
        } else if (v.type === "boolean" && typeof val !== "boolean") {
          val = Boolean(val);
        } else if (v.type === "json" && typeof val === "string") {
          try {
            val = JSON.parse(val);
          } catch (e) {
            throw new PromptValidationException(`Variable "${v.name}" must be valid JSON.`);
          }
        } else if (v.type === "array" && !Array.isArray(val)) {
          throw new PromptValidationException(`Variable "${v.name}" must be an array.`);
        }
      }

      finalVars[v.name] = val;
    }

    // Helper for rendering template string placeholders: {{placeholder}}
    const renderString = (str?: string): string | undefined => {
      if (!str) return undefined;
      return str.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, p1) => {
        if (finalVars[p1] === undefined) {
          throw new PromptValidationException(
            `invalid placeholders: Variable placeholder "{{${p1}}}" has no matching defined variable.`
          );
        }
        const val = finalVars[p1];
        if (val === null || val === undefined) return "";
        if (typeof val === "object") {
          return JSON.stringify(val);
        }
        return String(val);
      });
    };

    const systemPrompt = renderString(template.systemPrompt);
    const developerPrompt = renderString(template.developerPrompt);
    const userPrompt = renderString(template.userPrompt);

    return {
      promptId: template.id,
      version: template.version,
      systemPrompt,
      developerPrompt,
      userPrompt,
      variables: finalVars,
      renderedAt: new Date(),
    };
  }

  public static renderLegacy(
    content: string,
    variables: Record<string, unknown>,
    variablesDef: readonly any[]
  ): string {
    let result = content;
    // Replace all placeholders
    for (const v of variablesDef) {
      let val = variables[v.name];
      if (val === undefined || val === null) {
        if (v.required) {
          throw new PromptValidationException(`Variable "${v.name}" is required but not provided.`);
        }
        val = v.defaultValue !== undefined ? v.defaultValue : "";
      }
      result = result.replace(new RegExp(`\\{\\{\\s*${v.name}\\s*\\}\\}`, "g"), String(val));
    }
    return result;
  }
}
