import { ChannelManagerEngine } from "./ChannelManagerEngine";
import {
  IAccountManager,
  IOAuthManager,
  ISynchronizer,
  IUploadQueueManager,
  IScheduleManager,
  ICapabilityResolver,
  IChannelMonitor,
  IHistoryManager,
  IChannelProvider,
} from "./interfaces";
import { ChannelManagerValidationException } from "./types";

export class ChannelManagerBuilder {
  private _context?: any;
  private _configuration?: any;
  private _metadata: Record<string, unknown> = {};
  private _accountManager?: IAccountManager;
  private _oauthManager?: IOAuthManager;
  private _synchronizer?: ISynchronizer;
  private _queueManager?: IUploadQueueManager;
  private _scheduler?: IScheduleManager;
  private _capResolver?: ICapabilityResolver;
  private _monitor?: IChannelMonitor;
  private _historyManager?: IHistoryManager;
  private _extraProviders: IChannelProvider[] = [];

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

  public withAccountManager(manager: IAccountManager): this {
    this._accountManager = manager;
    return this;
  }

  public withOAuthManager(manager: IOAuthManager): this {
    this._oauthManager = manager;
    return this;
  }

  public withSynchronizer(synchronizer: ISynchronizer): this {
    this._synchronizer = synchronizer;
    return this;
  }

  public withQueueManager(manager: IUploadQueueManager): this {
    this._queueManager = manager;
    return this;
  }

  public withScheduler(scheduler: IScheduleManager): this {
    this._scheduler = scheduler;
    return this;
  }

  public withCapabilityResolver(resolver: ICapabilityResolver): this {
    this._capResolver = resolver;
    return this;
  }

  public withChannelMonitor(monitor: IChannelMonitor): this {
    this._monitor = monitor;
    return this;
  }

  public withHistoryManager(manager: IHistoryManager): this {
    this._historyManager = manager;
    return this;
  }

  /** Register an additional platform provider (e.g. Pinterest, Vimeo) */
  public withProvider(provider: IChannelProvider): this {
    this._extraProviders.push(provider);
    return this;
  }

  public build(): ChannelManagerEngine {
    if (!this._context) {
      throw new ChannelManagerValidationException(
        "Context is required to build a ChannelManagerEngine."
      );
    }
    return new ChannelManagerEngine(
      this._context,
      this._configuration,
      this._metadata,
      this._accountManager,
      this._oauthManager,
      this._synchronizer,
      this._queueManager,
      this._scheduler,
      this._capResolver,
      this._monitor,
      this._historyManager,
      this._extraProviders.length > 0 ? this._extraProviders : undefined
    );
  }
}
