import { Config } from "./Config";
import { ConfigSchema } from "./ConfigSchema";
import { ConfigSource } from "./ConfigSource";
import { ConfigValidator, DefaultConfigValidator } from "./ConfigValidator";
import { IConfig } from "./IConfig";

export class ConfigBuilder {
  private readonly _schema: ConfigSchema;
  private readonly _sources: ConfigSource[] = [];
  private _validator: ConfigValidator = new DefaultConfigValidator();

  constructor(schema: ConfigSchema) {
    this._schema = schema;
  }

  public withSource(source: ConfigSource): this {
    this._sources.push(source);
    return this;
  }

  public withValidator(validator: ConfigValidator): this {
    this._validator = validator;
    return this;
  }

  public async build(): Promise<IConfig> {
    const config = new Config(this._schema, this._sources, this._validator);
    await config.reload();
    return config;
  }
}
