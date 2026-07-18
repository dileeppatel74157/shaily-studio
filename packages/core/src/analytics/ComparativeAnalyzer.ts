import { IComparativeAnalyzer } from "./optimization-interfaces";
import { AnalyticsResponse }    from "./models";
import { ComparativeAnalysis }  from "./optimization-models";
import { NormalizedMetrics }    from "./models";

type MetricKey = keyof NormalizedMetrics;

export class DefaultComparativeAnalyzer implements IComparativeAnalyzer {
  public compare(
    type: ComparativeAnalysis["type"],
    baselineId: string,
    comparisonId: string,
    history: AnalyticsResponse[]
  ): ComparativeAnalysis {
    const baseline   = history.find(r => r.platformAnalytics.platformVideoId === baselineId
      || r.requestId === baselineId);
    const comparison = history.find(r => r.platformAnalytics.platformVideoId === comparisonId
      || r.requestId === comparisonId);

    const bMetrics = baseline?.platformAnalytics.normalizedMetrics ?? this._emptyMetrics();
    const cMetrics = comparison?.platformAnalytics.normalizedMetrics ?? this._emptyMetrics();

    const deltas: Partial<Record<MetricKey, number>> = {};
    const keys: MetricKey[] = ["views", "ctrPercent", "averageRetentionPercent", "likes", "engagementRate", "revenueUsd", "subscribersGained"];

    let compWins = 0;
    let baseWins = 0;
    for (const key of keys) {
      const bVal = bMetrics[key] as number ?? 0;
      const cVal = cMetrics[key] as number ?? 0;
      const delta = bVal > 0 ? ((cVal - bVal) / bVal) * 100 : 0;
      deltas[key] = Math.round(delta * 10) / 10;
      if (delta > 2)  compWins++;
      if (delta < -2) baseWins++;
    }

    const bScore = baseline?.performanceScore.overall ?? 0;
    const cScore = comparison?.performanceScore.overall ?? 0;
    const winner: ComparativeAnalysis["winner"] = cScore > bScore ? "COMPARISON" : bScore > cScore ? "BASELINE" : "TIE";
    const winMargin = Math.abs(cScore - bScore);

    const insights: string[] = [];
    if ((deltas.ctrPercent ?? 0) > 5) insights.push(`Comparison has ${deltas.ctrPercent?.toFixed(1)}% higher CTR.`);
    if ((deltas.averageRetentionPercent ?? 0) > 5) insights.push(`Comparison retains ${deltas.averageRetentionPercent?.toFixed(1)}% more of its audience.`);
    if ((deltas.views ?? 0) > 20) insights.push(`Comparison received ${deltas.views?.toFixed(0)}% more views.`);
    if (insights.length === 0) insights.push("Performance is broadly similar between baseline and comparison.");

    return {
      id:                 `comparison-${Date.now()}`,
      type,
      baselineId,
      comparisonId,
      baselineLabel:      baseline?.videoAnalytics.title ?? baselineId,
      comparisonLabel:    comparison?.videoAnalytics.title ?? comparisonId,
      platform:           baseline?.platform,
      deltas,
      baselineMetrics:    bMetrics,
      comparisonMetrics:  cMetrics,
      winner,
      winMargin,
      insights,
      generatedAt:        new Date(),
    };
  }

  private _emptyMetrics(): NormalizedMetrics {
    return {
      views: 0, watchTimeMinutes: 0, ctrPercent: 0, averageRetentionPercent: 0,
      likes: 0, comments: 0, shares: 0, subscribersGained: 0, followersGained: 0,
      revenueUsd: 0, rpmUsd: 0, cpmUsd: 0, impressions: 0, engagementRate: 0,
    };
  }
}
