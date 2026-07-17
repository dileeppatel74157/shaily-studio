import { ResearchEngine } from "./ResearchEngine";
import {
  ITrendProvider,
  ICompetitorAnalyzer,
  IOpportunityFinder,
  IKeywordAnalyzer,
  IAudienceAnalyzer,
} from "./interfaces";

export class ResearchBuilder {
  private _context?: any;
  private _configuration?: any;
  private _metadata: Record<string, unknown> = {};
  private _trendProvider?: ITrendProvider;
  private _competitorAnalyzer?: ICompetitorAnalyzer;
  private _opportunityFinder?: IOpportunityFinder;
  private _keywordAnalyzer?: IKeywordAnalyzer;
  private _audienceAnalyzer?: IAudienceAnalyzer;

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

  public withTrendProvider(provider: ITrendProvider): this {
    this._trendProvider = provider;
    return this;
  }

  public withCompetitorAnalyzer(analyzer: ICompetitorAnalyzer): this {
    this._competitorAnalyzer = analyzer;
    return this;
  }

  public withOpportunityFinder(finder: IOpportunityFinder): this {
    this._opportunityFinder = finder;
    return this;
  }

  public withKeywordAnalyzer(analyzer: IKeywordAnalyzer): this {
    this._keywordAnalyzer = analyzer;
    return this;
  }

  public withAudienceAnalyzer(analyzer: IAudienceAnalyzer): this {
    this._audienceAnalyzer = analyzer;
    return this;
  }

  public build(): ResearchEngine {
    if (!this._context) {
      throw new Error("Context is required to build a ResearchEngine.");
    }
    return new ResearchEngine(
      this._context,
      this._configuration,
      this._metadata,
      this._trendProvider,
      this._competitorAnalyzer,
      this._opportunityFinder,
      this._keywordAnalyzer,
      this._audienceAnalyzer
    );
  }
}
