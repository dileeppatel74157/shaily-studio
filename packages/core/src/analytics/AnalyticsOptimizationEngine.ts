import { IOptimizationEngine, IRankingEngine, IABTestEngine, ITrendPredictor, ISnapshotScheduler, IComparativeAnalyzer } from "./optimization-interfaces";
import { AnalyticsPlatform }     from "./AnalyticsPlatform";
import { MetricType }            from "./MetricType";
import { RecommendationType }    from "./RecommendationType";
import { SnapshotInterval }      from "./SnapshotInterval";
import { RankingType }           from "./RankingType";
import { PredictionType }        from "./PredictionType";
import { AnalyticsResponse, AnalyticsRecommendation } from "./models";
import {
  OptimizationRequest,
  OptimizationResponse,
  OptimizationRecommendation,
  ABTest,
  ABTestVariant,
  AnalyticsSnapshotEntry,
  ComparativeAnalysis,
  AnalyticsRanking,
  ABTestResult,
  TrendPrediction,
} from "./optimization-models";
import { DefaultRankingEngine }       from "./RankingEngine";
import { DefaultABTestEngine }        from "./ABTestEngine";
import { DefaultTrendPredictor }      from "./TrendPredictionEngine";
import { DefaultSnapshotScheduler }   from "./SnapshotScheduler";
import { DefaultComparativeAnalyzer } from "./ComparativeAnalyzer";
import { AnalyticsOptimizationValidator } from "./AnalyticsOptimizationValidator";

export class AnalyticsOptimizationEngine implements IOptimizationEngine {
  private readonly _ranking:    IRankingEngine;
  private readonly _abTest:     IABTestEngine;
  private readonly _predictor:  ITrendPredictor;
  private readonly _snapshot:   ISnapshotScheduler;
  private readonly _comparator: IComparativeAnalyzer;

  constructor(
    public readonly context: any,
    ranking?:    IRankingEngine,
    abTest?:     IABTestEngine,
    predictor?:  ITrendPredictor,
    snapshot?:   ISnapshotScheduler,
    comparator?: IComparativeAnalyzer,
    public readonly metadata: Record<string, unknown> = {}
  ) {
    this._ranking    = ranking    || new DefaultRankingEngine();
    this._abTest     = abTest     || new DefaultABTestEngine();
    this._predictor  = predictor  || new DefaultTrendPredictor();
    this._snapshot   = snapshot   || new DefaultSnapshotScheduler();
    this._comparator = comparator || new DefaultComparativeAnalyzer();
  }

  public async optimize(
    request: OptimizationRequest,
    history: AnalyticsResponse[]
  ): Promise<OptimizationResponse> {
    AnalyticsOptimizationValidator.validateRequest(request);
    AnalyticsOptimizationValidator.validateHistory(history);

    await this._emit("AnalyticsStarted", request.id, { platforms: request.platforms });

    const rankings:      AnalyticsRanking[]             = [];
    const abTestResults: ABTestResult[]                 = [];
    const predictions:   TrendPrediction[]              = [];
    const comparisons:   ComparativeAnalysis[]          = [];
    const snapshots:     AnalyticsSnapshotEntry[]       = [];
    const recommendations: OptimizationRecommendation[] = [];

    // ── Rankings ─────────────────────────────────────────────────────────────
    if (request.options.runRanking !== false) {
      const rankTypes = [
        RankingType.BEST_VIDEOS, RankingType.WORST_VIDEOS,
        RankingType.BEST_TOPICS, RankingType.BEST_HOOKS,
        RankingType.BEST_THUMBNAILS, RankingType.BEST_PUBLISHING_TIMES,
        RankingType.BEST_VIDEO_LENGTHS,
      ];
      for (const platform of request.platforms) {
        for (const type of rankTypes) {
          const r = this._ranking.rank(type, platform, history, request.options.windowDays);
          rankings.push(r);
        }
      }
      await this._emit("PerformanceUpdated", request.id, { rankings: rankings.length });
    }

    // ── A/B Tests ────────────────────────────────────────────────────────────
    if (request.options.runABTests !== false && history.length >= 2) {
      // Auto-create A/B tests from pairs of videos in history
      for (const platform of request.platforms) {
        const platformHistory = history.filter(r => r.platform === platform);
        if (platformHistory.length < 2) continue;

        const [a, b] = platformHistory.slice(-2);
        const testId = `auto-test-${platform.toLowerCase()}-${request.id}`;

        const makeVariant = (resp: AnalyticsResponse, label: string): ABTestVariant => ({
          id:               `${testId}-${label.toLowerCase()}`,
          testId,
          label,
          description:      resp.videoAnalytics.title,
          platformVideoId:  resp.platformAnalytics.platformVideoId,
          content:          { title: resp.videoAnalytics.title },
          metrics:          resp.platformAnalytics.normalizedMetrics,
          isWinner:         false,
          impressions:      resp.platformAnalytics.normalizedMetrics.impressions,
          clicks:           Math.round(resp.platformAnalytics.normalizedMetrics.impressions * resp.platformAnalytics.normalizedMetrics.ctrPercent / 100),
          views:            resp.platformAnalytics.normalizedMetrics.views,
          ctrPercent:       resp.platformAnalytics.normalizedMetrics.ctrPercent,
          retentionPercent: resp.platformAnalytics.normalizedMetrics.averageRetentionPercent,
          score:            resp.performanceScore.overall,
        });

        const test: ABTest = {
          id: testId, name: `Auto A/B — ${platform}`,
          variable:          "TITLE",
          platform:          platform as unknown as AnalyticsPlatform,
          status:            "RUNNING" as any,
          variants:          [makeVariant(a, "A"), makeVariant(b, "B")],
          startedAt:         new Date(Date.now() - 7 * 86_400_000),
          durationDays:      7,
          minViewsThreshold: 100,
          confidence:        0,
          createdAt:         new Date(Date.now() - 7 * 86_400_000),
          metadata:          {},
        };
        this._abTest.createTest(test);
        this._abTest.updateTest(testId, test.variants.map(v => v.metrics!));
      }
      const results = this._abTest.evaluate();
      abTestResults.push(...results);

      for (const result of results) {
        await this._emit("ABTestFinished", request.id, {
          testId: result.testId, winner: result.winnerLabel, ctrLift: result.ctrLift,
        });
      }
    }

    // ── Trend Predictions ────────────────────────────────────────────────────
    if (request.options.runPredictions !== false && history.length >= 2) {
      const preds = this._predictor.predict(history, request.platforms);
      predictions.push(...preds);
      for (const pred of preds) {
        await this._emit("PredictionGenerated", request.id, {
          type: pred.type, subject: pred.subject, direction: pred.direction, confidence: pred.confidence,
        });
      }
    }

    // ── Comparative Analysis ─────────────────────────────────────────────────
    if (request.options.runComparative !== false && history.length >= 2) {
      const sorted = [...history].sort((a, b) => b.performanceScore.overall - a.performanceScore.overall);
      // Compare best vs worst
      const best  = sorted[0];
      const worst = sorted[sorted.length - 1];
      if (best && worst && best.requestId !== worst.requestId) {
        const comp = this._comparator.compare(
          "VIDEO_VS_VIDEO",
          worst.platformAnalytics.platformVideoId,
          best.platformAnalytics.platformVideoId,
          history
        );
        comparisons.push(comp);
      }
      // Current vs Previous (if enough history)
      if (history.length >= 2) {
        const recent = history[history.length - 1];
        const prev   = history[history.length - 2];
        const monthComp = this._comparator.compare(
          "CURRENT_VS_PREVIOUS",
          prev.platformAnalytics.platformVideoId,
          recent.platformAnalytics.platformVideoId,
          history
        );
        comparisons.push(monthComp);
      }
    }

    // ── Snapshots ────────────────────────────────────────────────────────────
    if (request.options.runSnapshots !== false) {
      const intervals = request.options.snapshotIntervals ?? [SnapshotInterval.DAILY, SnapshotInterval.WEEKLY];
      for (const resp of history) {
        for (const interval of intervals) {
          const entry = this._snapshot.capture(
            resp.platformAnalytics.platformVideoId,
            interval,
            resp.platformAnalytics.normalizedMetrics,
            resp.performanceScore
          );
          snapshots.push(entry);
        }
      }
      await this._emit("SnapshotCreated", request.id, { count: snapshots.length });
    }

    // ── Optimization Recommendations ─────────────────────────────────────────
    recommendations.push(...this._generateOptimizationRecommendations(history, rankings, predictions, abTestResults, request));
    for (const rec of recommendations) {
      await this._emit("RecommendationGenerated", request.id, { type: rec.type, impact: rec.expectedImpactPercent });
    }

    // ── Validate ─────────────────────────────────────────────────────────────
    AnalyticsOptimizationValidator.validatePredictionConfidence(predictions);

    // ── Feedback to engines ──────────────────────────────────────────────────
    let feedbackSent   = false;
    let enginesUpdated: string[] = [];
    if (request.options.feedbackToEngines !== false) {
      enginesUpdated = await this.feedbackToEngines(
        { id: `opt-${request.id}`, requestId: request.id, rankings, abTestResults, predictions, comparisons, snapshots, recommendations, feedbackSent: false, enginesUpdated: [], timestamp: new Date() },
        this.context
      );
      feedbackSent = enginesUpdated.length > 0;
    }

    // ── Memory ───────────────────────────────────────────────────────────────
    if (this.context?.memoryStore) {
      await this.context.memoryStore.set("analytics",         `opt:${request.id}`, { rankings: rankings.length, predictions: predictions.length });
      await this.context.memoryStore.set("analytics-history", `history:${request.id}`, history.length);
      await this.context.memoryStore.set("performance",       `scores:${request.id}`, history.map(r => r.performanceScore.overall));
      await this.context.memoryStore.set("ab-tests",          `tests:${request.id}`, abTestResults.length);
      await this.context.memoryStore.set("recommendations",   `recs:${request.id}`, recommendations.length);
      await this.context.memoryStore.set("rankings",          `ranks:${request.id}`, rankings.map(r => r.type));
      await this.context.memoryStore.set("predictions",       `preds:${request.id}`, predictions.map(p => p.type));
    }

    const response: OptimizationResponse = {
      id:              `opt-resp-${request.id}`,
      requestId:       request.id,
      rankings,
      abTestResults,
      predictions,
      comparisons,
      snapshots,
      recommendations,
      feedbackSent,
      enginesUpdated,
      timestamp:       new Date(),
    };

    await this._emit("AnalyticsCompleted", request.id, {
      rankings: rankings.length,
      abTests:  abTestResults.length,
      predictions: predictions.length,
      recommendations: recommendations.length,
    });

    return response;
  }

  public async feedbackToEngines(
    response: OptimizationResponse,
    context: any
  ): Promise<string[]> {
    const updated: string[] = [];
    const data = {
      requestId:       response.requestId,
      rankings:        response.rankings,
      predictions:     response.predictions,
      abTestResults:   response.abTestResults,
      recommendations: response.recommendations,
    };

    const engines: Array<{ key: string; method: string; label: string }> = [
      { key: "researchEngine",    method: "updateTrends",          label: "ResearchEngine"    },
      { key: "strategyEngine",    method: "updatePriorities",      label: "StrategyEngine"    },
      { key: "channelEngine",     method: "updateChannelInsights", label: "ChannelEngine"     },
      { key: "scriptEngine",      method: "learnFromAnalytics",    label: "ScriptEngine"      },
      { key: "productionEngine",  method: "applyOptimizations",    label: "ProductionEngine"  },
      { key: "generationEngine",  method: "applyOptimizations",    label: "GenerationEngine"  },
      { key: "compositionEngine", method: "applyOptimizations",    label: "CompositionEngine" },
      { key: "renderingEngine",   method: "applyOptimizations",    label: "RenderingEngine"   },
      { key: "publishingEngine",  method: "applyOptimizations",    label: "PublishingEngine"  },
    ];

    for (const { key, method, label } of engines) {
      if (context?.[key]?.[method]) {
        try {
          await context[key][method](data);
          updated.push(label);
        } catch (_) {}
      }
    }

    // Decision Engine
    if (context?.registry?.has?.({ name: "IDecisionEngine" })) {
      try {
        const dec = context.registry.resolve?.({ name: "IDecisionEngine" }) as any;
        if (dec?.record) {
          await dec.record({
            optimizationRequestId: response.requestId,
            topRankedVideoId:      response.rankings[0]?.entries[0]?.entityId,
            predictionsCount:      response.predictions.length,
            feedbackSent:          true,
          });
          updated.push("DecisionEngine");
        }
      } catch (_) {}
    }

    return updated;
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private _generateOptimizationRecommendations(
    history: AnalyticsResponse[],
    rankings: AnalyticsRanking[],
    predictions: TrendPrediction[],
    abResults: ABTestResult[],
    request: OptimizationRequest
  ): OptimizationRecommendation[] {
    const recs: OptimizationRecommendation[] = [];

    // From Rankings
    const worstRanking = rankings.find(r => r.type === RankingType.WORST_VIDEOS);
    if (worstRanking && worstRanking.entries.length > 0) {
      recs.push({
        id:                   `opt-rec-worst-${request.id}`,
        type:                 RecommendationType.HOOK,
        priority:             "HIGH",
        title:                "Analyse and fix worst-performing videos",
        description:          `${worstRanking.entries.length} videos are significantly underperforming. Study and avoid their patterns.`,
        expectedImpactPercent: 20,
        targetMetric:         MetricType.VIEWS,
        evidence:             `Worst video score: ${worstRanking.entries[0]?.score ?? 0}/100`,
        action:               "REVIEW_WORST_VIDEOS",
        parameters:           { videoIds: worstRanking.entries.map(e => e.entityId) },
        targetEngine:         "ScriptEngine",
        aiGenerated:          true,
        triggerVideoIds:      worstRanking.entries.map(e => e.entityId),
      });
    }

    const bestTimingRanking = rankings.find(r => r.type === RankingType.BEST_PUBLISHING_TIMES);
    if (bestTimingRanking && bestTimingRanking.entries.length > 0) {
      const bestHour = bestTimingRanking.entries[0];
      recs.push({
        id:                   `opt-rec-timing-${request.id}`,
        type:                 RecommendationType.POSTING_TIME,
        priority:             "MEDIUM",
        title:                `Publish videos at ${bestHour.entityLabel}`,
        description:          `Your audience is most active at this time — maximize organic reach.`,
        expectedImpactPercent: 15,
        targetMetric:         MetricType.VIEWS,
        evidence:             bestHour.reason,
        action:               "UPDATE_SCHEDULE",
        parameters:           { recommendedHour: bestHour.attributes.hour },
        targetEngine:         "PublishingEngine",
        aiGenerated:          true,
        triggerVideoIds:      [],
      });
    }

    // From Predictions
    for (const pred of predictions) {
      if (!pred.actionable || !pred.suggestedAction) continue;
      recs.push({
        id:                   `opt-rec-pred-${pred.id}`,
        type:                 RecommendationType.TITLE,
        priority:             pred.confidence > 0.8 ? "HIGH" : "MEDIUM",
        title:                `Predicted trend: ${pred.subject}`,
        description:          pred.suggestedAction,
        expectedImpactPercent: Math.round(pred.confidence * 30),
        targetMetric:         MetricType.VIEWS,
        evidence:             pred.reasoning,
        action:               "APPLY_TREND_PREDICTION",
        parameters:           { predictionType: pred.type, direction: pred.direction, horizonDays: pred.horizonDays },
        targetEngine:         "ResearchEngine",
        aiGenerated:          true,
        predictionId:         pred.id,
        triggerVideoIds:      [],
      });
    }

    // From A/B Tests
    for (const result of abResults) {
      recs.push(...result.recommendations.map(r => ({
        ...r,
        targetEngine:    "PublishingEngine",
        aiGenerated:     true,
        abTestId:        result.testId,
        triggerVideoIds: [],
      } as OptimizationRecommendation)));
    }

    // CTR / hook / retention recommendations from aggregated history
    if (history.length > 0) {
      const avgCTR = history.reduce((s, r) => s + r.platformAnalytics.normalizedMetrics.ctrPercent, 0) / history.length;
      const avgRet = history.reduce((s, r) => s + r.platformAnalytics.normalizedMetrics.averageRetentionPercent, 0) / history.length;

      if (avgCTR < 3) {
        recs.push({
          id: `opt-rec-ctr-${request.id}`, type: RecommendationType.THUMBNAIL,
          priority: "MEDIUM",
          title: "Improve thumbnail quality — CTR is below 3%",
          description: "Average CTR across recent videos is low. Test bolder, higher-contrast thumbnails.",
          expectedImpactPercent: 30, targetMetric: MetricType.CTR,
          evidence: `Average CTR: ${avgCTR.toFixed(1)}% (target: 5%+)`,
          action: "REDESIGN_THUMBNAILS", parameters: { currentAvgCtr: avgCTR, targetCtr: 5 },
          targetEngine: "GenerationEngine", aiGenerated: true, triggerVideoIds: [],
        });
      }

      if (avgRet < 40) {
        recs.push({
          id: `opt-rec-ret-${request.id}`, type: RecommendationType.HOOK,
          priority: "CRITICAL",
          title: "Strengthen hooks — average retention below 40%",
          description: "Reduce intro length, open with the most compelling moment, add pattern interrupts every 30 seconds.",
          expectedImpactPercent: 35, targetMetric: MetricType.RETENTION,
          evidence: `Average retention: ${avgRet.toFixed(1)}% (target: 55%+)`,
          action: "REWRITE_HOOKS", parameters: { currentAvgRetention: avgRet, targetRetention: 55 },
          targetEngine: "ScriptEngine", aiGenerated: true, triggerVideoIds: [],
        });
      }
    }

    return recs;
  }

  private async _emit(name: string, correlationId: string, payload: Record<string, unknown>): Promise<void> {
    if (this.context?.eventBus?.publish) {
      try {
        await this.context.eventBus.publish({
          id: `evt-${name.toLowerCase()}-${Math.random().toString(36).substring(2, 7)}`,
          name, timestamp: new Date(), correlationId,
          source: "AnalyticsOptimizationEngine", payload, metadata: {},
        });
      } catch (_) {}
    }
  }
}
