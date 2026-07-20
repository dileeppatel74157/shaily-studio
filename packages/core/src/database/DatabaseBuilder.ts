import { IDatabaseEngine }          from "./interfaces";
import { DatabaseEngine }           from "./DatabaseEngine";
import { DatabaseConfiguration }    from "./models";
import { DatabaseProvider }         from "./DatabaseProvider";
import { CachePolicy }              from "./CachePolicy";
import { DatabaseValidationException } from "./types";

/**
 * Fluent dependency-injection builder for DatabaseEngine.
 *
 * @example
 * ```ts
 * const db = new DatabaseBuilder()
 *   .withContext(ctx)
 *   .withProvider(DatabaseProvider.SQLITE)
 *   .withFilePath("./data/shaily.db")
 *   .withCachePolicy(CachePolicy.READ_THROUGH)
 *   .build();
 * ```
 */
export class DatabaseBuilder {
  private _context?: any;
  private _provider: DatabaseProvider = DatabaseProvider.SQLITE;
  private _host?: string;
  private _port?: number;
  private _database?: string;
  private _username?: string;
  private _password?: string;
  private _filePath?: string;
  private _url?: string;
  private _poolSize?: number;
  private _maxConnections?: number;
  private _connectionTimeoutMs?: number;
  private _enableSSL?: boolean;
  private _enableWAL?: boolean;
  private _cachePolicy?: CachePolicy;
  private _cacheTTLMs?: number;
  private _maxCacheEntries?: number;
  private _metadata?: Record<string, unknown>;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withProvider(provider: DatabaseProvider): this {
    this._provider = provider;
    return this;
  }

  public withHost(host: string): this {
    this._host = host;
    return this;
  }

  public withPort(port: number): this {
    this._port = port;
    return this;
  }

  public withDatabase(database: string): this {
    this._database = database;
    return this;
  }

  public withCredentials(username: string, password: string): this {
    this._username = username;
    this._password = password;
    return this;
  }

  public withFilePath(filePath: string): this {
    this._filePath = filePath;
    return this;
  }

  public withUrl(url: string): this {
    this._url = url;
    return this;
  }

  public withPoolSize(size: number): this {
    this._poolSize = size;
    return this;
  }

  public withMaxConnections(max: number): this {
    this._maxConnections = max;
    return this;
  }

  public withConnectionTimeoutMs(ms: number): this {
    this._connectionTimeoutMs = ms;
    return this;
  }

  public withSSL(enable = true): this {
    this._enableSSL = enable;
    return this;
  }

  public withWAL(enable = true): this {
    this._enableWAL = enable;
    return this;
  }

  public withCachePolicy(policy: CachePolicy): this {
    this._cachePolicy = policy;
    return this;
  }

  public withCacheTTL(ms: number): this {
    this._cacheTTLMs = ms;
    return this;
  }

  public withMaxCacheEntries(max: number): this {
    this._maxCacheEntries = max;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = metadata;
    return this;
  }

  public build(): IDatabaseEngine {
    if (!this._context) {
      throw new DatabaseValidationException("Context is required to build DatabaseEngine.");
    }

    const config: DatabaseConfiguration = {
      provider: this._provider,
      host: this._host,
      port: this._port,
      database: this._database,
      username: this._username,
      password: this._password,
      filePath: this._filePath,
      url: this._url,
      poolSize: this._poolSize,
      maxConnections: this._maxConnections,
      connectionTimeoutMs: this._connectionTimeoutMs,
      enableSSL: this._enableSSL,
      enableWAL: this._enableWAL,
      cachePolicy: this._cachePolicy ?? CachePolicy.READ_THROUGH,
      cacheTTLMs: this._cacheTTLMs,
      maxCacheEntries: this._maxCacheEntries,
      metadata: this._metadata
    };

    return new DatabaseEngine(this._context, config);
  }
}
