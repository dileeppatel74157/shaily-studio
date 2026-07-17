import { ResearchState } from "./ResearchState";
import { ResearchType } from "./ResearchType";
import { TrendType } from "./TrendType";
import { OpportunityType } from "./OpportunityType";
import { KeywordType } from "./KeywordType";
import { AudienceType } from "./AudienceType";

export interface ResearchRequest {
  id: string;
  type: ResearchType;
  channelProfile: Record<string, any>;
  state: ResearchState;
  timestamp: Date;
  correlationId?: string;
  options?: Record<string, any>;
}

export interface ResearchResponse {
  requestId: string;
  state: ResearchState;
  topics: ResearchTopic[];
  opportunities: Opportunity[];
  competitorProfile?: CompetitorProfile[];
  trendAnalysis?: TrendAnalysis;
  keywordAnalysis?: KeywordAnalysis[];
  audienceInsight?: AudienceInsight;
  topicClusters?: TopicCluster[];
  reports: ResearchReport[];
  timestamp: Date;
}

export interface ResearchTopic {
  id: string;
  topic: string;
  category: string;
  growthScore: number;
  competitionScore: number;
  trendScore: number;
  monetizationScore: number;
  audienceMatchScore: number;
  confidenceScore: number;
  finalScore: number;
  tags: string[];
  metadata: Record<string, any>;
}

export interface TrendAnalysis {
  trendingTopics: Array<{ topic: string; growthScore: number; competitionScore: number; trendScore: number; type: TrendType }>;
  risingTopics: Array<{ topic: string; growthScore: number; competitionScore: number; trendScore: number; type: TrendType }>;
  evergreenTopics: Array<{ topic: string; growthScore: number; competitionScore: number; trendScore: number; type: TrendType }>;
  seasonalOpportunities: Array<{ topic: string; growthScore: number; competitionScore: number; trendScore: number; type: TrendType }>;
}

export interface CompetitorProfile {
  competitorName: string;
  uploadFrequency: string;
  videoStyle: string[];
  averageViews: number;
  averageEngagement: number;
  thumbnailPatterns: string[];
  titlePatterns: string[];
  publishingTime: string[];
}

export interface Opportunity {
  id: string;
  topic: string;
  score: number;
  type: OpportunityType;
  demand: number;
  competition: number;
  rpmPotential: number;
  contentGapDescription: string;
}

export interface KeywordAnalysis {
  primaryKeywords: string[];
  secondaryKeywords: string[];
  longTailKeywords: string[];
  searchIntent: string;
  difficultyScore: number;
  keywordType: KeywordType;
}

export interface AudienceInsight {
  interests: string[];
  painPoints: string[];
  commonQuestions: string[];
  viewingBehavior: string;
  preferredContentLength: string;
  audienceType: AudienceType;
}

export interface TopicCluster {
  id: string;
  name: string;
  topics: string[];
  type: "Series" | "Category" | "Content Pillar";
}

export interface ResearchScore {
  trendScore: number;
  opportunityScore: number;
  competitionScore: number;
  monetizationScore: number;
  audienceMatchScore: number;
  confidenceScore: number;
  finalScore: number;
}

export interface ResearchReport {
  id: string;
  timestamp: Date;
  bestTopics: ResearchTopic[];
  bestOpportunities: Opportunity[];
  competitorSummary: string;
  keywordSummary: string;
  audienceSummary: string;
  recommendedNextActions: string[];
}

export interface ResearchSnapshot {
  requestId: string;
  state: ResearchState;
  topics: ReadonlyArray<ResearchTopic>;
  opportunities: ReadonlyArray<Opportunity>;
  timestamp: Date;
}
