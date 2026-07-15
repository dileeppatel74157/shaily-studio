import { ISecurity } from "./ISecurity";
import { Security } from "./Security";
import { SecurityContext } from "./SecurityContext";
import { SecurityPolicy } from "./SecurityPolicy";
import { EncryptionProvider, Base64EncryptionProvider } from "./EncryptionProvider";
import { SecurityValidationException } from "./types";

export class SecurityBuilder {
  private _context?: SecurityContext;
  private _policy?: SecurityPolicy;
  private _encryptionProvider?: EncryptionProvider;
  private _metadata: Record<string, unknown> = {};

  public withContext(context: SecurityContext): this {
    this._context = context;
    return this;
  }

  public withPolicy(policy: SecurityPolicy): this {
    this._policy = policy;
    return this;
  }

  public withEncryptionProvider(provider: EncryptionProvider): this {
    this._encryptionProvider = provider;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public build(): ISecurity {
    if (!this._context) {
      throw new SecurityValidationException("SecurityContext is required to build Security.");
    }
    if (!this._policy) {
      throw new SecurityValidationException("SecurityPolicy is required to build Security.");
    }

    const provider = this._encryptionProvider || new Base64EncryptionProvider();

    return new Security(
      this._context,
      this._policy,
      provider,
      this._metadata
    );
  }
}
