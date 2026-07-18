import { QualityEngine } from "./QualityEngine";
import {
  IVisualAnalyzer,
  IAudioAnalyzer,
  ISubtitleAnalyzer,
  IBrandAnalyzer,
  IQualityScorer,
  IAutoFixEngine,
} from "./interfaces";
import { QualityValidationException } from "./types";

export class QualityBuilder {
  private _context?: any;
  private _configuration?: any;
  private _metadata: Record<string, unknown> = {};
  private _visualAnalyzer?: IVisualAnalyzer;
  private _audioAnalyzer?: IAudioAnalyzer;
  private _subtitleAnalyzer?: ISubtitleAnalyzer;
  private _brandAnalyzer?: IBrandAnalyzer;
  private _scorer?: IQualityScorer;
  private _fixEngine?: IAutoFixEngine;

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

  public withVisualAnalyzer(analyzer: IVisualAnalyzer): this {
    this._visualAnalyzer = analyzer;
    return this;
  }

  public withAudioAnalyzer(analyzer: IAudioAnalyzer): this {
    this._audioAnalyzer = analyzer;
    return this;
  }

  public withSubtitleAnalyzer(analyzer: ISubtitleAnalyzer): this {
    this._subtitleAnalyzer = analyzer;
    return this;
  }

  public withBrandAnalyzer(analyzer: IBrandAnalyzer): this {
    this._brandAnalyzer = analyzer;
    return this;
  }

  public withScorer(scorer: IQualityScorer): this {
    this._scorer = scorer;
    return this;
  }

  public withFixEngine(fixEngine: IAutoFixEngine): this {
    this._fixEngine = fixEngine;
    return this;
  }

  public build(): QualityEngine {
    if (!this._context) {
      throw new QualityValidationException(
        "Context is required to build a QualityEngine."
      );
    }
    return new QualityEngine(
      this._context,
      this._configuration,
      this._metadata,
      this._visualAnalyzer,
      this._audioAnalyzer,
      this._subtitleAnalyzer,
      this._brandAnalyzer,
      this._scorer,
      this._fixEngine
    );
  }
}
