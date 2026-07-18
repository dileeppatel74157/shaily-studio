import { AnalyticsOptimizationEngine } from "./AnalyticsOptimizationEngine";
import {
  IRankingEngine,
  IABTestEngine,
  ITrendPredictor,
  ISnapshotScheduler,
  IComparativeAnalyzer,
} from "./optimization-interfaces";
import { OptimizationValidationException } from "./AnalyticsOptimizationValidator";

export class AnalyticsOptimizationBuilder {
  private _context?: any;
  private _metadata: Record<string, unknown> = {};
  private _ranking?:    IRankingEngine;
  private _abTest?:     IABTestEngine;
  private _predictor?:  ITrendPredictor;
  private _snapshot?:   ISnapshotScheduler;
  private _comparator?: IComparativeAnalyzer;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...metadata };
    return this;
  }

  public withRankingEngine(engine: IRankingEngine): this {
    this._ranking = engine;
    return this;
  }

  public withABTestEngine(engine: IABTestEngine): this {
    this._abTest = engine;
    return this;
  }

  public withTrendPredictor(predictor: ITrendPredictor): this {
    this._predictor = predictor;
    return this;
  }

  public withSnapshotScheduler(scheduler: ISnapshotScheduler): this {
    this._snapshot = scheduler;
    return this;
  }

  public withComparativeAnalyzer(analyzer: IComparativeAnalyzer): this {
    this._comparator = analyzer;
    return this;
  }

  public build(): AnalyticsOptimizationEngine {
    if (!this._context) {
      throw new OptimizationValidationException(
        "Context is required to build an AnalyticsOptimizationEngine."
      );
    }
    return new AnalyticsOptimizationEngine(
      this._context,
      this._ranking,
      this._abTest,
      this._predictor,
      this._snapshot,
      this._comparator,
      this._metadata
    );
  }
}
