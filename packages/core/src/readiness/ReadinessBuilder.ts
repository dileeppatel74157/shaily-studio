import { IPlatform } from "../platform/IPlatform";
import { ReadinessContext } from "./ReadinessContext";
import { ReadinessConfiguration } from "./ReadinessConfiguration";
import { Readiness } from "./Readiness";
import { ReadinessValidator } from "./ReadinessValidator";
import { ReadinessValidationException } from "./types";

export class ReadinessBuilder {
  private _platform?: IPlatform;
  private _context?: ReadinessContext;
  private _configuration?: ReadinessConfiguration;
  private _metadata: Record<string, unknown> = {};

  public withPlatform(platform: IPlatform): this {
    this._platform = platform;
    return this;
  }

  public withContext(context: ReadinessContext): this {
    this._context = context;
    return this;
  }

  public withConfiguration(configuration: ReadinessConfiguration): this {
    this._configuration = configuration;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    for (const key of Object.keys(metadata)) {
      if (Object.prototype.hasOwnProperty.call(this._metadata, key)) {
        throw new ReadinessValidationException(`Duplicate metadata key detected: "${key}"`);
      }
    }
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public build(): Readiness {
    if (!this._platform) {
      throw new ReadinessValidationException("Platform is required to build Readiness.");
    }
    if (!this._context) {
      throw new ReadinessValidationException("Context is required to build Readiness.");
    }
    if (!this._configuration) {
      throw new ReadinessValidationException("Configuration is required to build Readiness.");
    }

    ReadinessValidator.validateMetadata(this._metadata);

    return new Readiness(
      this._context,
      this._configuration,
      this._metadata
    );
  }
}
