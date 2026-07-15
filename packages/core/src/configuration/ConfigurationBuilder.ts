import { IConfiguration } from "./IConfiguration";
import { Configuration } from "./Configuration";
import { ConfigurationContext } from "./ConfigurationContext";
import { ConfigurationSchema } from "./ConfigurationSchema";
import { ConfigurationProvider } from "./ConfigurationProvider";
import { ConfigurationValidationException } from "./types";

export class ConfigurationBuilder {
  private _context?: ConfigurationContext;
  private _schema?: ConfigurationSchema;
  private readonly _providers: ConfigurationProvider[] = [];
  private _metadata: Record<string, unknown> = {};

  public withContext(context: ConfigurationContext): this {
    this._context = context;
    return this;
  }

  public withSchema(schema: ConfigurationSchema): this {
    this._schema = schema;
    return this;
  }

  public withProvider(provider: ConfigurationProvider): this {
    this._providers.push(provider);
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public build(): IConfiguration {
    if (!this._context) {
      throw new ConfigurationValidationException("ConfigurationContext is required to build Configuration.");
    }
    if (!this._schema) {
      throw new ConfigurationValidationException("ConfigurationSchema is required to build Configuration.");
    }

    return new Configuration(
      this._context,
      this._schema,
      this._providers,
      this._metadata
    );
  }
}
