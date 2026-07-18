import { PublishingEngine } from "./PublishingEngine";
import {
  IMetadataBuilder,
  ISchedulePlanner,
  IUploadManager,
  IRetryManager,
  IPublishingMonitor,
  IPlatformProvider,
} from "./interfaces";
import { PublishingValidationException } from "./types";

export class PublishingBuilder {
  private _context?: any;
  private _configuration?: any;
  private _metadata: Record<string, unknown> = {};
  private _metadataBuilder?: IMetadataBuilder;
  private _schedulePlanner?: ISchedulePlanner;
  private _uploadManager?: IUploadManager;
  private _retryManager?: IRetryManager;
  private _monitor?: IPublishingMonitor;
  private _extraProviders: IPlatformProvider[] = [];

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withConfiguration(configuration: any): this {
    this._configuration = configuration;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...metadata };
    return this;
  }

  public withMetadataBuilder(builder: IMetadataBuilder): this {
    this._metadataBuilder = builder;
    return this;
  }

  public withSchedulePlanner(planner: ISchedulePlanner): this {
    this._schedulePlanner = planner;
    return this;
  }

  public withUploadManager(manager: IUploadManager): this {
    this._uploadManager = manager;
    return this;
  }

  public withRetryManager(manager: IRetryManager): this {
    this._retryManager = manager;
    return this;
  }

  public withMonitor(monitor: IPublishingMonitor): this {
    this._monitor = monitor;
    return this;
  }

  /**
   * Register additional platform providers (e.g. Pinterest, Vimeo).
   * These extend the built-in set without modifying the engine.
   */
  public withProvider(provider: IPlatformProvider): this {
    this._extraProviders.push(provider);
    return this;
  }

  public build(): PublishingEngine {
    if (!this._context) {
      throw new PublishingValidationException(
        "Context is required to build a PublishingEngine."
      );
    }
    return new PublishingEngine(
      this._context,
      this._configuration,
      this._metadata,
      this._metadataBuilder,
      this._schedulePlanner,
      this._uploadManager,
      this._retryManager,
      this._monitor,
      this._extraProviders.length > 0 ? this._extraProviders : undefined
    );
  }
}
