import { IStorage } from "./IStorage";
import { Storage } from "./Storage";
import { StorageContext } from "./StorageContext";
import { StorageProvider, InMemoryStorageProvider } from "./StorageProvider";
import { StorageValidationException } from "./types";

export class StorageBuilder {
  private _context?: StorageContext;
  private _provider?: StorageProvider;
  private _metadata: Record<string, unknown> = {};

  public withContext(context: StorageContext): this {
    this._context = context;
    return this;
  }

  public withProvider(provider: StorageProvider): this {
    this._provider = provider;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public build(): IStorage {
    if (!this._context) {
      throw new StorageValidationException("StorageContext is required to build Storage.");
    }

    const provider = this._provider || new InMemoryStorageProvider();

    return new Storage(
      this._context,
      provider,
      this._metadata
    );
  }
}
