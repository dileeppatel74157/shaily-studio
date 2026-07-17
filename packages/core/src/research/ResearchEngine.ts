import { IResearchEngine } from "./interfaces";
import { ResearchState } from "./ResearchState";
import { ResearchType } from "./ResearchType";
import { TrendType } from "./TrendType";
import { OpportunityType } from "./OpportunityType";
import { KeywordType } from "./KeywordType";
import { AudienceType } from "./AudienceType";
import {
  ResearchRequest,
  ResearchResponse,
  ResearchTopic,
  TrendAnalysis,
  CompetitorProfile,
  Opportunity,
  KeywordAnalysis,
  AudienceInsight,
  TopicCluster,
  ResearchReport,
  ResearchSnapshot,
} from "./models";
import {
  ITrendProvider,
  ICompetitorAnalyzer,
  IOpportunityFinder,
  IKeywordAnalyzer,
  IAudienceAnalyzer,
} from "./interfaces";
import { ResearchValidator } from "./ResearchValidator";
import {
  ResearchException,
  ResearchValidationException,
  InvalidResearchStateException,
  DuplicateResearchException,
  deepFreeze,
} from "./types";

export class ResearchEngine implements IResearchEngine {
  private _state = ResearchState.CREATED;
  private readonly _requests = new Map<string, ResearchRequest>();
  private readonly _history: ResearchResponse[] = [];
  private readonly _snapshots = new Map<string, ResearchSnapshot>();

  // Mock fallbacks if no provider is configured (for provider-independent operation)
  private readonly _trendProvider: ITrendProvider;
  private readonly _competitorAnalyzer: ICompetitorAnalyzer;
  private readonly _opportunityFinder: IOpportunityFinder;
  private readonly _keywordAnalyzer: IKeywordAnalyzer;
  private readonly _audienceAnalyzer: IAudienceAnalyzer;

  constructor(
    public readonly context: any,
    public readonly configuration?: any,
    public readonly metadata: Record<string, unknown> = {},
    trendProvider?: ITrendProvider,
    competitorAnalyzer?: ICompetitorAnalyzer,
    opportunityFinder?: IOpportunityFinder,
    keywordAnalyzer?: IKeywordAnalyzer,
    audienceAnalyzer?: IAudienceAnalyzer
  ) {
    this._trendProvider = trendProvider || {
      discoverTrends: async (profile) => ({
        trendingTopics: [
          { topic: "AI Coding Assistants", growthScore: 0.9, competitionScore: 0.7, trendScore: 0.85, type: TrendType.TRENDING },
        ],
        risingTopics: [
          { topic: "WebGPU Programming", growthScore: 0.8, competitionScore: 0.4, trendScore: 0.75, type: TrendType.RISING },
        ],
        evergreenTopics: [
          { topic: "TypeScript Best Practices", growthScore: 0.6, competitionScore: 0.3, trendScore: 0.65, type: TrendType.EVERGREEN },
        ],
        seasonalOpportunities: [
          { topic: "Developer Gift Guide 2026", growthScore: 0.7, competitionScore: 0.5, trendScore: 0.6, type: TrendType.SEASONAL },
        ],
      }),
    };

    this._competitorAnalyzer = competitorAnalyzer || {
      analyzeCompetitors: async (profile) => [
        {
          competitorName: "TechVlog Pro",
          uploadFrequency: "Weekly",
          videoStyle: ["Tutorials", "Talking Head"],
          averageViews: 120000,
          averageEngagement: 0.08,
          thumbnailPatterns: ["Bright text", "Face close-up"],
          titlePatterns: ["How to...", "X secrets of..."],
          publishingTime: ["Tuesday 3PM EST"],
        },
      ],
    };

    this._opportunityFinder = opportunityFinder || {
      findOpportunities: async (trends, competitors) => [
        {
          id: "opp-1",
          topic: "TypeScript Best Practices",
          score: 0.85,
          type: OpportunityType.LOW_COMPETITION,
          demand: 0.8,
          competition: 0.3,
          rpmPotential: 0.7,
          contentGapDescription: "High search volume but low quality tutorials online.",
        },
        {
          id: "opp-2",
          topic: "WebGPU Programming",
          score: 0.9,
          type: OpportunityType.CONTENT_GAP,
          demand: 0.9,
          competition: 0.2,
          rpmPotential: 0.85,
          contentGapDescription: "Almost zero detailed guides on WebGPU with TypeScript.",
        },
      ],
    };

    this._keywordAnalyzer = keywordAnalyzer || {
      analyzeKeywords: async (topics) => [
        {
          primaryKeywords: ["typescript tips", "advanced typescript"],
          secondaryKeywords: ["typescript generic helper", "typescript utility types"],
          longTailKeywords: ["how to write advanced typescript utility types for nodejs"],
          searchIntent: "educational",
          difficultyScore: 0.3,
          keywordType: KeywordType.PRIMARY,
        },
      ],
    };

    this._audienceAnalyzer = audienceAnalyzer || {
      analyzeAudience: async (profile) => ({
        interests: ["software development", "web performance", "rust", "typescript"],
        painPoints: ["complex builds", "type errors", "slow rendering"],
        commonQuestions: ["How to debug performance issues in production?", "Vite vs Webpack in 2026?"],
        viewingBehavior: "Prefers code walkthroughs over high-level overviews",
        preferredContentLength: "12-15 minutes",
        audienceType: AudienceType.CORE,
      }),
    };
  }

  public get state(): ResearchState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state !== ResearchState.CREATED) {
      throw new InvalidResearchStateException("engine", "initialize", this._state);
    }
    this._state = ResearchState.INITIALIZED;
    if (this.context.logger) {
      this.context.logger.info("ResearchEngine initialized successfully.");
    }
  }

  public async start(): Promise<void> {
    if (this._state !== ResearchState.INITIALIZED && this._state !== ResearchState.STOPPED) {
      throw new InvalidResearchStateException("engine", "start", this._state);
    }
    this._state = ResearchState.RUNNING;
    if (this.context.logger) {
      this.context.logger.info("ResearchEngine started.");
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== ResearchState.RUNNING) {
      throw new InvalidResearchStateException("engine", "stop", this._state);
    }
    this._state = ResearchState.STOPPED;
    if (this.context.logger) {
      this.context.logger.info("ResearchEngine stopped.");
    }
  }

  public getSnapshot(requestId: string): ResearchSnapshot {
    const snapshot = this._snapshots.get(requestId);
    if (!snapshot) {
      throw new ResearchException(`No snapshot found for research request "${requestId}"`);
    }
    return snapshot;
  }

  public getHistory(): ResearchResponse[] {
    return [...this._history];
  }

  public async execute(request: ResearchRequest): Promise<ResearchResponse> {
    if (this._state !== ResearchState.RUNNING) {
      throw new InvalidResearchStateException(request.id, "execute", this._state);
    }

    // 1. Validator Rules check (Request check)
    ResearchValidator.validateRequest(request);

    // Duplicate request ID prevention
    if (this._requests.has(request.id)) {
      throw new DuplicateResearchException(request.id);
    }
    this._requests.set(request.id, request);

    // 2. Duplicate research prevention using memory history & memory store
    // Check if channel profile hash or main topic is already researched
    const queryKey = request.channelProfile.query || request.channelProfile.channelName || "default";
    
    // Check local history
    const isDuplicate = this._history.some(
      (h) => h.state === ResearchState.COMPLETED &&
      (h.topics.some((t) => t.topic.toLowerCase() === queryKey.toLowerCase()) || 
       h.requestId === request.id)
    );
    if (isDuplicate) {
      throw new ResearchException(`Duplicate research request detected for key/ID: ${queryKey}`);
    }

    // Check Memory Engine / Memory Store
    if (this.context.memoryStore) {
      const existing = await this.context.memoryStore.get("research-memory", `research:${queryKey}`);
      if (existing) {
        if (request.options?.allowCached) {
          if (this.context.logger) {
            this.context.logger.info(`Returning cached research response for: ${queryKey}`);
          }
          return existing.value as ResearchResponse;
        } else {
          throw new ResearchException(`Duplicate research request detected in Memory Store for: ${queryKey}`);
        }
      }
    }

    // Publish event ResearchStarted
    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-start-" + Math.random().toString(36).substring(2, 11),
        name: "ResearchStarted",
        timestamp: new Date(),
        correlationId: request.correlationId || "corr-research-" + request.id,
        source: "ResearchEngine",
        payload: { requestId: request.id, type: request.type },
        metadata: {},
      });
    }

    try {
      // 3. Execution flow
      let trends: TrendAnalysis | undefined;
      let competitors: CompetitorProfile[] | undefined;
      let opportunities: Opportunity[] = [];
      let keywords: KeywordAnalysis[] | undefined;
      let audience: AudienceInsight | undefined;

      // State transitions
      this._state = ResearchState.TREND_DISCOVERY;
      if (request.type === ResearchType.TRENDS || request.type === ResearchType.FULL) {
        trends = await this._trendProvider.discoverTrends(request.channelProfile);
      }

      this._state = ResearchState.COMPETITOR_ANALYSIS;
      if (request.type === ResearchType.COMPETITORS || request.type === ResearchType.FULL) {
        competitors = await this._competitorAnalyzer.analyzeCompetitors(request.channelProfile);
      }

      this._state = ResearchState.OPPORTUNITY_FINDING;
      if (request.type === ResearchType.OPPORTUNITIES || request.type === ResearchType.FULL) {
        const activeTrends = trends || { trendingTopics: [], risingTopics: [], evergreenTopics: [], seasonalOpportunities: [] };
        const activeCompetitors = competitors || [];
        opportunities = await this._opportunityFinder.findOpportunities(activeTrends, activeCompetitors);
      }

      this._state = ResearchState.KEYWORD_ANALYSIS;
      if (request.type === ResearchType.KEYWORDS || request.type === ResearchType.FULL) {
        const topicsList = opportunities.map((o) => o.topic);
        keywords = await this._keywordAnalyzer.analyzeKeywords(topicsList);
      }

      this._state = ResearchState.AUDIENCE_ANALYSIS;
      if (request.type === ResearchType.AUDIENCE || request.type === ResearchType.FULL) {
        audience = await this._audienceAnalyzer.analyzeAudience(request.channelProfile);
      }

      // 4. Topic Clustering
      this._state = ResearchState.CLUSTERING;
      const topicClusters: TopicCluster[] = [];
      if (opportunities.length > 0) {
        const topics = opportunities.map((o) => o.topic);
        topicClusters.push({
          id: "cluster-1",
          name: "Main Content Pillars",
          topics: topics,
          type: "Content Pillar",
        });
      }

      // 5. Research Scoring Engine
      this._state = ResearchState.SCORING;
      const generatedTopics: ResearchTopic[] = opportunities.map((opp, idx) => {
        const trendScore = Math.min(1.0, Math.max(0.0, opp.score - 0.05));
        const competitionScore = opp.competition;
        const monetizationScore = opp.rpmPotential;
        const audienceMatchScore = 0.8;
        const confidenceScore = 0.9;
        
        // aggregate formula: finalScore in [0, 1]
        const rawScore = (trendScore + opp.demand + (1.0 - competitionScore) + monetizationScore + audienceMatchScore) / 5;
        const finalScore = Number((rawScore * confidenceScore).toFixed(4));

        return {
          id: "topic-" + idx + "-" + Math.random().toString(36).substring(2, 7),
          topic: opp.topic,
          category: "Technology",
          growthScore: opp.demand,
          competitionScore,
          trendScore,
          monetizationScore,
          audienceMatchScore,
          confidenceScore,
          finalScore,
          tags: ["tech", "development"],
          metadata: {
            opportunityId: opp.id,
            contentGapDescription: opp.contentGapDescription,
          },
        };
      });

      // Sort topics by final score descending
      generatedTopics.sort((a, b) => b.finalScore - a.finalScore);

      // 6. Research Reports
      const report: ResearchReport = {
        id: "rep-" + request.id + "-" + Math.random().toString(36).substring(2, 7),
        timestamp: new Date(),
        bestTopics: generatedTopics.slice(0, 3),
        bestOpportunities: opportunities.slice(0, 3),
        competitorSummary: competitors ? `Analyzed ${competitors.length} competitors.` : "No competitor data analyzed.",
        keywordSummary: keywords ? `Generated analysis for ${keywords.length} keyword clusters.` : "No keyword analysis generated.",
        audienceSummary: audience ? `Audience interests: ${audience.interests.join(", ")}` : "No audience analysis generated.",
        recommendedNextActions: [
          "Produce high quality videos on: " + (generatedTopics[0]?.topic || "No topics"),
          "Optimize for search intent: " + (keywords?.[0]?.searchIntent || "educational"),
        ],
      };

      const response: ResearchResponse = {
        requestId: request.id,
        state: ResearchState.COMPLETED,
        topics: generatedTopics,
        opportunities,
        competitorProfile: competitors,
        trendAnalysis: trends,
        keywordAnalysis: keywords,
        audienceInsight: audience,
        topicClusters,
        reports: [report],
        timestamp: new Date(),
      };

      // 7. Validator Rules check (Response check)
      ResearchValidator.validateResponse(response);

      // 8. Store snapshot and freeze it
      const snapshot: ResearchSnapshot = {
        requestId: request.id,
        state: ResearchState.COMPLETED,
        topics: response.topics,
        opportunities: response.opportunities,
        timestamp: response.timestamp,
      };

      deepFreeze(snapshot);
      this._snapshots.set(request.id, snapshot);

      // 9. Store to history
      this._history.push(response);

      // 10. Store in MemoryEngine / MemoryStore
      if (this.context.memoryStore) {
        await this.context.memoryStore.set(
          "research-memory",
          `research:${queryKey}`,
          response,
          { requestId: request.id, topicCount: response.topics.length }
        );
      }

      // Publish event ResearchCompleted
      if (this.context.eventBus) {
        await this.context.eventBus.publish({
          id: "evt-complete-" + Math.random().toString(36).substring(2, 11),
          name: "ResearchCompleted",
          timestamp: new Date(),
          correlationId: request.correlationId || "corr-research-" + request.id,
          source: "ResearchEngine",
          payload: { requestId: request.id, topicsCount: response.topics.length },
          metadata: {},
        });
      }

      // Link research response to strategy engine creation request if strategyEngine is available
      if (this.context.strategyEngine && request.options?.generateStrategy) {
        try {
          await this.context.strategyEngine.generate({
            id: "req-str-linked-" + request.id,
            type: "FULL" as any,
            researchResponse: response,
            state: "CREATED" as any,
            timestamp: new Date()
          });
        } catch (e) {
          // Ignore
        }
      }

      this._state = ResearchState.RUNNING; // return to running state when done
      return response;
    } catch (error: any) {
      this._state = ResearchState.FAILED;
      
      // Publish event ResearchFailed
      if (this.context.eventBus) {
        await this.context.eventBus.publish({
          id: "evt-fail-" + Math.random().toString(36).substring(2, 11),
          name: "ResearchFailed",
          timestamp: new Date(),
          correlationId: request.correlationId || "corr-research-" + request.id,
          source: "ResearchEngine",
          payload: { requestId: request.id, error: error.message },
          metadata: {},
        });
      }
      throw error;
    }
  }
}
