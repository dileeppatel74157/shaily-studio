import { VideoCompositionEngine } from "./VideoCompositionEngine";
import {
  ITimelineBuilder,
  ITrackComposer,
  ITransitionPlanner,
  IEffectPlanner,
  ISynchronizationEngine,
  ICompositionMetricsBuilder,
} from "./interfaces";
import { VideoCompositionValidationException } from "./types";

export class VideoCompositionBuilder {
  private _context?: any;
  private _configuration?: any;
  private _metadata: Record<string, unknown> = {};
  private _timelineBuilder?:   ITimelineBuilder;
  private _trackComposer?:     ITrackComposer;
  private _transitionPlanner?: ITransitionPlanner;
  private _effectPlanner?:     IEffectPlanner;
  private _syncEngine?:        ISynchronizationEngine;
  private _metricsBuilder?:    ICompositionMetricsBuilder;

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

  public withTimelineBuilder(builder: ITimelineBuilder): this {
    this._timelineBuilder = builder;
    return this;
  }

  public withTrackComposer(composer: ITrackComposer): this {
    this._trackComposer = composer;
    return this;
  }

  public withTransitionPlanner(planner: ITransitionPlanner): this {
    this._transitionPlanner = planner;
    return this;
  }

  public withEffectPlanner(planner: IEffectPlanner): this {
    this._effectPlanner = planner;
    return this;
  }

  public withSyncEngine(engine: ISynchronizationEngine): this {
    this._syncEngine = engine;
    return this;
  }

  public withMetricsBuilder(builder: ICompositionMetricsBuilder): this {
    this._metricsBuilder = builder;
    return this;
  }

  public build(): VideoCompositionEngine {
    if (!this._context) {
      throw new VideoCompositionValidationException(
        "Context is required to build a VideoCompositionEngine."
      );
    }
    return new VideoCompositionEngine(
      this._context,
      this._configuration,
      this._metadata,
      this._timelineBuilder,
      this._trackComposer,
      this._transitionPlanner,
      this._effectPlanner,
      this._syncEngine,
      this._metricsBuilder
    );
  }
}
