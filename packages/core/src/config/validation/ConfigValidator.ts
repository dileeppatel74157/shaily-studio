import { ConfigSchema } from "./ConfigSchema";

export interface ConfigValidator {
  validate(data: Record<string, unknown>, schema: ConfigSchema): void;
}

export class DefaultConfigValidator implements ConfigValidator {
  public validate(data: Record<string, unknown>, schema: ConfigSchema): void {
    for (const [key, property] of Object.entries(schema)) {
      let value = data[key];

      if (value === undefined && property.default !== undefined) {
        value = property.default;
        data[key] = value;
      }

      if (property.required && value === undefined) {
        throw new Error(`Configuration property "${key}" is required but was not provided.`);
      }

      if (value !== undefined) {
        if (property.type === "number") {
          const parsed = Number(value);
          if (isNaN(parsed)) {
            throw new Error(`Configuration property "${key}" must be a number, got "${value}".`);
          }
          data[key] = parsed;
        } else if (property.type === "boolean") {
          const str = String(value).toLowerCase();
          if (str === "true" || value === true || str === "1") {
            data[key] = true;
          } else if (str === "false" || value === false || str === "0") {
            data[key] = false;
          } else {
            throw new Error(`Configuration property "${key}" must be a boolean, got "${value}".`);
          }
        } else if (property.type === "enum") {
          const str = String(value);
          if (!property.enumValues || !property.enumValues.includes(str)) {
            throw new Error(
              `Configuration property "${key}" must be one of [${property.enumValues?.join(
                ", "
              )}], got "${value}".`
            );
          }
          data[key] = str;
        } else if (property.type === "string") {
          data[key] = String(value);
        }
      }
    }
  }
}
