import { ISystemIntegrationEngine } from "./interfaces";
import { SystemIntegrationEngine } from "./SystemIntegrationEngine";
import { IntegrationValidationException } from "./types";
import { IntegrationConfiguration } from "./models";

export class SystemIntegrationBuilder {
  private _context?: any;
  private _config?: Partial<IntegrationConfiguration>;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withConfig(config: Partial<IntegrationConfiguration>): this {
    this._config = config;
    return this;
  }

  public build(): ISystemIntegrationEngine {
    if (!this._context) {
      throw new IntegrationValidationException("Context is required to build SystemIntegrationEngine.");
    }

    return new SystemIntegrationEngine(this._context, this._config);
  }
}
