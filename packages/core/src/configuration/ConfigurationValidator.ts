import { ConfigurationSchema, ConfigurationSchemaItem } from "./ConfigurationSchema";
import { ConfigurationContext } from "./ConfigurationContext";
import { ConfigurationProvider } from "./ConfigurationProvider";
import { ConfigurationValidationException } from "./types";

export class ConfigurationValidator {
  private static readonly KEY_REGEX = /^[a-zA-Z0-9_.-]+$/;

  public static validateIdentifier(id: string, name: string): void {
    if (!id || typeof id !== "string" || id.trim() === "") {
      throw new ConfigurationValidationException(`${name} identifier must be a non-empty string`);
    }
    if (!this.KEY_REGEX.test(id)) {
      throw new ConfigurationValidationException(
        `${name} identifier "${id}" contains invalid characters. Only alphanumeric, dots, dashes, and underscores are allowed.`
      );
    }
  }

  public static validateContext(context: ConfigurationContext): void {
    if (!context) {
      throw new ConfigurationValidationException("ConfigurationContext cannot be null or undefined");
    }
    this.validateIdentifier(context.env, "Context environment (env)");
    this.validateIdentifier(context.namespace, "Context namespace");
  }

  public static validateSchema(schema: ConfigurationSchema): void {
    if (!schema) {
      throw new ConfigurationValidationException("Schema cannot be null or undefined");
    }
    const allowedTypes = ["string", "number", "boolean", "enum"];
    
    for (const key of Object.keys(schema)) {
      this.validateIdentifier(key, "Schema key");
      const item = schema[key];
      if (!item) {
        throw new ConfigurationValidationException(`Schema definition for key "${key}" is empty`);
      }
      if (!allowedTypes.includes(item.type)) {
        throw new ConfigurationValidationException(`Invalid schema type "${item.type}" for key "${key}"`);
      }
      if (item.type === "enum") {
        if (!item.enumValues || !Array.isArray(item.enumValues) || item.enumValues.length === 0) {
          throw new ConfigurationValidationException(`Enum key "${key}" must define non-empty "enumValues" array`);
        }
        item.enumValues.forEach((val) => {
          if (typeof val !== "string" || val.trim() === "") {
            throw new ConfigurationValidationException(`Enum value in key "${key}" must be a non-empty string`);
          }
        });
      }
      if (item.default !== undefined) {
        this.validateValueType(key, item.default, item);
      }
    }
  }

  public static validateValueType(key: string, value: unknown, item: ConfigurationSchemaItem): void {
    if (value === undefined || value === null) {
      if (item.required) {
        throw new ConfigurationValidationException(`Configuration key "${key}" is required but was not provided`);
      }
      return;
    }

    if (item.type === "string") {
      if (typeof value !== "string") {
        throw new ConfigurationValidationException(
          `Configuration key "${key}" must be a string, got type: ${typeof value}`
        );
      }
    } else if (item.type === "number") {
      if (typeof value !== "number" || isNaN(value)) {
        throw new ConfigurationValidationException(
          `Configuration key "${key}" must be a number, got value: ${value}`
        );
      }
    } else if (item.type === "boolean") {
      if (typeof value !== "boolean") {
        throw new ConfigurationValidationException(
          `Configuration key "${key}" must be a boolean, got type: ${typeof value}`
        );
      }
    } else if (item.type === "enum") {
      if (typeof value !== "string") {
        throw new ConfigurationValidationException(
          `Configuration key "${key}" enum value must be a string, got type: ${typeof value}`
        );
      }
      if (!item.enumValues || !item.enumValues.includes(value)) {
        throw new ConfigurationValidationException(
          `Configuration key "${key}" enum value must be one of: [${item.enumValues?.join(", ")}], got: "${value}"`
        );
      }
    }
  }

  public static validateRequiredValues(schema: ConfigurationSchema, values: Record<string, unknown>): void {
    for (const key of Object.keys(schema)) {
      const item = schema[key];
      if (item.required && (values[key] === undefined || values[key] === null)) {
        throw new ConfigurationValidationException(`Configuration key "${key}" is required but was not provided`);
      }
    }
  }

  public static validateProvider(provider: ConfigurationProvider, existingProviders: ConfigurationProvider[]): void {
    if (!provider) {
      throw new ConfigurationValidationException("Provider cannot be null or undefined");
    }
    this.validateIdentifier(provider.name, "Provider name");
    if (typeof provider.priority !== "number" || isNaN(provider.priority)) {
      throw new ConfigurationValidationException(`Provider "${provider.name}" priority must be a number`);
    }
    const duplicate = existingProviders.find((p) => p.name === provider.name);
    if (duplicate) {
      throw new ConfigurationValidationException(`Duplicate provider detected with name: "${provider.name}"`);
    }
  }
}
