import { AnalyticsEngine } from "./AnalyticsEngine";
import {
  IMetricCollector,
  IPerformanceAnalyzer,
  IRecommendationEngine,
  IBenchmarkEngine,
  ILearningEngine,
  IAnalyticsProvider,
} from "./interfaces";
import { AnalyticsValidationException } from "./types";

export class AnalyticsBuilder {
  private _context?: any;
  private _configuration?: any;
  private _metadata: Record<string, unknown> = {};
  private _collector?: IMetricCollector;
  private _analyzer?: IPerformanceAnalyzer;
  private _recommender?: IRecommendationEngine;
  private _benchmark?: IBenchmarkEngine;
  private _learner?: ILearningEngine;
  private _extraProviders: IAnalyticsProvider[] = [];

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

  public withCollector(collector: IMetricCollector): this {
    this._collector = collector;
    return this;
  }

  public withAnalyzer(analyzer: IPerformanceAnalyzer): this {
    this._analyzer = analyzer;
    return this;
  }

  public withRecommendationEngine(engine: IRecommendationEngine): this {
    this._recommender = engine;
    return this;
  }

  public withBenchmark(benchmark: IBenchmarkEngine): this {
    this._benchmark = benchmark;
    return this;
  }

  public withLearningEngine(learner: ILearningEngine): this {
    this._learner = learner;
    return this;
  }

  /**
   * Register an additional analytics provider (e.g. Pinterest Analytics, Vimeo).
   * Extends the built-in set without modifying the engine.
   */
  public withProvider(provider: IAnalyticsProvider): this {
    this._extraProviders.push(provider);
    return this;
  }

  public build(): AnalyticsEngine {
    if (!this._context) {
      throw new AnalyticsValidationException(
        "Context is required to build an AnalyticsEngine."
      );
    }
    return new AnalyticsEngine(
      this._context,
      this._configuration,
      this._metadata,
      this._collector,
      this._analyzer,
      this._recommender,
      this._benchmark,
      this._learner,
      this._extraProviders.length > 0 ? this._extraProviders : undefined
    );
  }
}
