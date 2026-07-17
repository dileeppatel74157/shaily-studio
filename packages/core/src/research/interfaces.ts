import {
  ResearchRequest,
  ResearchResponse,
  ResearchSnapshot,
  TrendAnalysis,
  CompetitorProfile,
  Opportunity,
  KeywordAnalysis,
  AudienceInsight,
} from "./models";

export interface IResearchEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  execute(request: ResearchRequest): Promise<ResearchResponse>;
  getSnapshot(requestId: string): ResearchSnapshot;
  getHistory(): ResearchResponse[];
}

export interface ITrendProvider {
  discoverTrends(channelProfile: Record<string, any>): Promise<TrendAnalysis>;
}

export interface ICompetitorAnalyzer {
  analyzeCompetitors(channelProfile: Record<string, any>): Promise<CompetitorProfile[]>;
}

export interface IOpportunityFinder {
  findOpportunities(trends: TrendAnalysis, competitors: CompetitorProfile[]): Promise<Opportunity[]>;
}

export interface IKeywordAnalyzer {
  analyzeKeywords(topics: string[]): Promise<KeywordAnalysis[]>;
}

export interface IAudienceAnalyzer {
  analyzeAudience(channelProfile: Record<string, any>): Promise<AudienceInsight>;
}
