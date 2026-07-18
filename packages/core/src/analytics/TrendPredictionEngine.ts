import { ITrendPredictor }    from "./optimization-interfaces";
import { AnalyticsPlatform }   from "./AnalyticsPlatform";
import { PredictionType }      from "./PredictionType";
import { TrendDirection }      from "./TrendDirection";
import { TrendPrediction }     from "./optimization-models";
import { AnalyticsResponse }   from "./models";
import { MetricType }          from "./MetricType";

export class DefaultTrendPredictor implements ITrendPredictor {
  public predict(
    history: AnalyticsResponse[],
    platforms: AnalyticsPlatform[],
    types: PredictionType[] = Object.values(PredictionType)
  ): TrendPrediction[] {
    const predictions: TrendPrediction[] = [];

    for (const platform of platforms) {
      const relevant = history
        .filter(r => r.platform === platform)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      if (relevant.length < 2) continue;

      for (const type of types) {
        const pred = this._predictForType(type, platform, relevant);
        if (pred) predictions.push(pred);
      }
    }

    return predictions;
  }

  private _predictForType(
    type: PredictionType,
    platform: AnalyticsPlatform,
    history: AnalyticsResponse[]
  ): TrendPrediction | null {
    const now = new Date();

    switch (type) {

      case PredictionType.GROWING_TOPIC:
      case PredictionType.DECLINING_TOPIC: {
        // Analyze topic performance trend across history
        const topicScores = new Map<string, number[]>();
        for (const r of history) {
          for (const cat of r.audienceAnalytics.interestCategories ?? []) {
            const arr = topicScores.get(cat) ?? [];
            arr.push(r.performanceScore.overall);
            topicScores.set(cat, arr);
          }
        }
        let bestSubject = "Technology";
        let bestTrend   = 0;
        for (const [topic, scores] of topicScores) {
          if (scores.length < 2) continue;
          const firstHalf  = scores.slice(0, Math.ceil(scores.length / 2));
          const secondHalf = scores.slice(Math.ceil(scores.length / 2));
          const firstAvg   = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
          const secondAvg  = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
          const trend      = secondAvg - firstAvg;
          if (type === PredictionType.GROWING_TOPIC && trend > bestTrend) {
            bestTrend = trend; bestSubject = topic;
          } else if (type === PredictionType.DECLINING_TOPIC && trend < bestTrend) {
            bestTrend = trend; bestSubject = topic;
          }
        }
        return {
          id:            `pred-${type.toLowerCase()}-${Date.now()}`,
          type, platform,
          direction:     type === PredictionType.GROWING_TOPIC ? TrendDirection.RISING : TrendDirection.DECLINING,
          subject:       bestSubject,
          predictedDelta: Math.abs(bestTrend),
          predictedUnit: "score points/period",
          confidence:    history.length >= 5 ? 0.78 : 0.52,
          horizonDays:   30,
          dataPoints:    history.map(r => ({ date: r.timestamp, value: r.performanceScore.overall })),
          generatedAt:   now,
          reasoning:     `${bestSubject} shows a ${Math.abs(bestTrend).toFixed(1)} point ${type === PredictionType.GROWING_TOPIC ? "increase" : "decrease"} in average performance.`,
          actionable:    true,
          suggestedAction: type === PredictionType.GROWING_TOPIC
            ? `Increase content around "${bestSubject}" while momentum is rising.`
            : `Reduce content around "${bestSubject}" — audience interest is declining.`,
        };
      }

      case PredictionType.UPLOAD_WINDOW: {
        // Find the best upload window from audience data
        const hourCounts = new Array(24).fill(0);
        for (const r of history) {
          for (const h of r.audienceAnalytics.bestHoursOfDay ?? []) {
            if (h >= 0 && h < 24) hourCounts[h] += r.platformAnalytics.normalizedMetrics.views;
          }
        }
        const bestHour = hourCounts.indexOf(Math.max(...hourCounts));
        return {
          id:            `pred-upload-window-${Date.now()}`,
          type, platform,
          direction:     TrendDirection.STABLE,
          subject:       `Hour ${bestHour}:00–${bestHour + 1}:00`,
          predictedDelta: hourCounts[bestHour],
          predictedUnit: "additional views",
          confidence:    history.length >= 3 ? 0.82 : 0.60,
          horizonDays:   14,
          dataPoints:    hourCounts.map((v, h) => ({ date: new Date(), value: v })),
          generatedAt:   now,
          seasonality:   "Consistent across observed window",
          reasoning:     `Publishing at ${bestHour}:00 correlates with highest audience activity.`,
          actionable:    true,
          suggestedAction: `Schedule uploads at ${bestHour}:00 local time for maximum reach.`,
        };
      }

      case PredictionType.AUDIENCE_GROWTH: {
        const subGrowth = history.map(r => r.platformAnalytics.normalizedMetrics.subscribersGained);
        const recentAvg = subGrowth.slice(-3).reduce((s, v) => s + v, 0) / Math.max(subGrowth.slice(-3).length, 1);
        const olderAvg  = subGrowth.slice(0, 3).reduce((s, v) => s + v, 0) / Math.max(subGrowth.slice(0, 3).length, 1);
        const delta     = recentAvg - olderAvg;
        return {
          id:            `pred-audience-growth-${Date.now()}`,
          type, platform,
          direction:     delta >= 0 ? TrendDirection.RISING : TrendDirection.DECLINING,
          subject:       "Subscriber Growth",
          predictedDelta: Math.abs(delta),
          predictedUnit: "subscribers/video",
          confidence:    0.70,
          horizonDays:   30,
          dataPoints:    history.map((r, i) => ({ date: r.timestamp, value: subGrowth[i] ?? 0 })),
          generatedAt:   now,
          reasoning:     `Recent videos gain ${recentAvg.toFixed(0)} subs vs ${olderAvg.toFixed(0)} earlier.`,
          actionable:    delta < 0,
          suggestedAction: delta < 0 ? "Add stronger CTA to subscribe. Growth rate is declining." : undefined,
        };
      }

      case PredictionType.REVENUE_GROWTH: {
        const revenues = history.map(r => r.platformAnalytics.normalizedMetrics.revenueUsd);
        const recentRev = revenues.slice(-3).reduce((s, v) => s + v, 0) / Math.max(revenues.slice(-3).length, 1);
        const olderRev  = revenues.slice(0, 3).reduce((s, v) => s + v, 0) / Math.max(revenues.slice(0, 3).length, 1);
        const delta     = recentRev - olderRev;
        return {
          id:            `pred-revenue-growth-${Date.now()}`,
          type, platform,
          direction:     delta >= 0 ? TrendDirection.RISING : TrendDirection.DECLINING,
          subject:       "Revenue Per Video",
          predictedDelta: Math.abs(delta),
          predictedUnit: "USD",
          confidence:    0.65,
          horizonDays:   30,
          dataPoints:    history.map((r, i) => ({ date: r.timestamp, value: revenues[i] ?? 0 })),
          generatedAt:   now,
          reasoning:     `Revenue shifted from $${olderRev.toFixed(2)} to $${recentRev.toFixed(2)} per video.`,
          actionable:    true,
          suggestedAction: delta < 0 ? "Focus on mid-roll ad placement and longer watch times to recover RPM." : "Maintain current content strategy — revenue is growing.",
        };
      }

      default: return null;
    }
  }
}
