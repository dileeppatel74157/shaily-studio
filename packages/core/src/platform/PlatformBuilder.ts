import { IStudio } from "../studio/IStudio";
import { PlatformContext } from "./PlatformContext";
import { PlatformManifest } from "./PlatformManifest";
import { Platform } from "./Platform";
import { PlatformValidator } from "./PlatformValidator";
import { PlatformValidationException } from "./types";

export class PlatformBuilder {
  private _studio?: IStudio;
  private _context?: PlatformContext;
  private _manifest?: PlatformManifest;
  private _metadata: Record<string, unknown> = {};

  public withStudio(studio: IStudio): this {
    this._studio = studio;
    return this;
  }

  public withContext(context: PlatformContext): this {
    this._context = context;
    return this;
  }

  public withManifest(manifest: PlatformManifest): this {
    this._manifest = manifest;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    // Check for duplicate metadata keys (if merging keys from multiple withMetadata calls)
    for (const key of Object.keys(metadata)) {
      if (Object.prototype.hasOwnProperty.call(this._metadata, key)) {
        throw new PlatformValidationException(`Duplicate metadata key detected: "${key}"`);
      }
    }
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public build(): Platform {
    if (!this._studio) {
      throw new PlatformValidationException("Studio is required to build Platform.");
    }
    if (!this._context) {
      throw new PlatformValidationException("Context is required to build Platform.");
    }
    if (!this._manifest) {
      throw new PlatformValidationException("Manifest is required to build Platform.");
    }

    // Run validator rules
    PlatformValidator.validateManifest(this._manifest);
    PlatformValidator.validateContext(this._context);
    PlatformValidator.validateMetadata(this._metadata);

    return new Platform(
      this._studio,
      this._context,
      this._manifest,
      this._metadata
    );
  }
}
