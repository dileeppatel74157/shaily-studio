import { MemoryEngine } from "./MemoryEngine";
import { MemoryContext } from "./MemoryContext";
import { MemoryState } from "./MemoryState";

export interface MemoryConfiguration {
  readonly maxCacheSize?: number;
  readonly decayRate?: number;
  readonly learningEnabled?: boolean;
  readonly reflectionEnabled?: boolean;
}

export class MemoryBuilder {
  private _context?: MemoryContext;
  private _configuration?: MemoryConfiguration;
  private _metadata: Record<string, unknown> = {};

  public withContext(context: MemoryContext): this {
    this._context = context;
    return this;
  }

  public withConfiguration(configuration: MemoryConfiguration): this {
    this._configuration = configuration;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...metadata };
    return this;
  }

  public build(): MemoryEngine {
    if (!this._context) {
      throw new Error("Context is required to build a MemoryEngine.");
    }
    return new MemoryEngine(this._context, this._configuration, this._metadata);
  }
}
