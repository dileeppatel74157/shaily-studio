import { RenderEngine }       from "./RenderEngine";
import {
  IFrameRenderer,
  IEncoder,
  IExporter,
  IRenderOptimizer,
  IQualityAnalyzer,
} from "./interfaces";
import { RenderingValidationException } from "./types";

export class RenderBuilder {
  private _context?: any;
  private _configuration?: any;
  private _metadata: Record<string, unknown> = {};
  private _frameRenderer?:  IFrameRenderer;
  private _encoder?:        IEncoder;
  private _exporter?:       IExporter;
  private _optimizer?:      IRenderOptimizer;
  private _qualityAnalyzer?: IQualityAnalyzer;

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

  public withFrameRenderer(renderer: IFrameRenderer): this {
    this._frameRenderer = renderer;
    return this;
  }

  public withEncoder(encoder: IEncoder): this {
    this._encoder = encoder;
    return this;
  }

  public withExporter(exporter: IExporter): this {
    this._exporter = exporter;
    return this;
  }

  public withOptimizer(optimizer: IRenderOptimizer): this {
    this._optimizer = optimizer;
    return this;
  }

  public withQualityAnalyzer(analyzer: IQualityAnalyzer): this {
    this._qualityAnalyzer = analyzer;
    return this;
  }

  public build(): RenderEngine {
    if (!this._context) {
      throw new RenderingValidationException(
        "Context is required to build a RenderEngine."
      );
    }
    return new RenderEngine(
      this._context,
      this._configuration,
      this._metadata,
      this._frameRenderer,
      this._encoder,
      this._exporter,
      this._optimizer,
      this._qualityAnalyzer
    );
  }
}
