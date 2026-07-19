import { IConfigurationEngine } from "./interfaces";
import { ConfigurationEngine } from "./ConfigurationEngine";
import { ConfigurationValidationException } from "./types";

export class ConfigurationBuilder {
  private _context?: any;
  private _configPath?: string;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withConfigPath(path: string): this {
    this._configPath = path;
    return this;
  }

  public build(): IConfigurationEngine {
    if (!this._context) {
      throw new ConfigurationValidationException("Context is required to build ConfigurationEngine.");
    }

    return new ConfigurationEngine(this._context, this._configPath);
  }
}
