import { IRankingEngine }   from "./optimization-interfaces";
import { AnalyticsPlatform } from "./AnalyticsPlatform";
import { RankingType }       from "./RankingType";
import { MetricType }        from "./MetricType";
import { AnalyticsResponse } from "./models";
import { AnalyticsRanking, RankingEntry } from "./optimization-models";

export class DefaultRankingEngine implements IRankingEngine {
  public rank(
    type: RankingType,
    platform: AnalyticsPlatform,
    history: AnalyticsResponse[],
    windowDays = 30
  ): AnalyticsRanking {
    const cutoff  = new Date(Date.now() - windowDays * 86_400_000);
    const relevant = history.filter(
      r => r.platform === platform && r.timestamp >= cutoff
    );

    let entries: RankingEntry[] = [];
    let insight = "";

    switch (type) {

      case RankingType.BEST_VIDEOS:
      case RankingType.WORST_VIDEOS: {
        const sorted = [...relevant].sort((a, b) =>
          type === RankingType.BEST_VIDEOS
            ? b.performanceScore.overall - a.performanceScore.overall
            : a.performanceScore.overall - b.performanceScore.overall
        );
        entries = sorted.slice(0, 10).map((r, i) => ({
          rank:        i + 1,
          entityId:    r.platformAnalytics.platformVideoId,
          entityLabel: r.videoAnalytics.title,
          score:       r.performanceScore.overall,
          platform,
          metrics:     r.platformAnalytics.normalizedMetrics,
          reason:      type === RankingType.BEST_VIDEOS
            ? `Score ${r.performanceScore.overall}/100 — ${r.performanceScore.level}`
            : `Underperforming at ${r.performanceScore.overall}/100`,
          attributes: {
            hook:       r.performanceScore.hook,
            retention:  r.performanceScore.retention,
            ctr:        r.performanceScore.ctr,
          },
        }));
        insight = type === RankingType.BEST_VIDEOS
          ? `Top ${entries.length} videos by overall performance score.`
          : `Bottom ${entries.length} videos that need optimization attention.`;
        break;
      }

      case RankingType.BEST_TOPICS: {
        // Group by interest categories from audience analytics
        const topicMap = new Map<string, { totalScore: number; count: number }>();
        for (const r of relevant) {
          for (const cat of r.audienceAnalytics.interestCategories ?? []) {
            const cur = topicMap.get(cat) ?? { totalScore: 0, count: 0 };
            cur.totalScore += r.performanceScore.overall;
            cur.count++;
            topicMap.set(cat, cur);
          }
        }
        const sorted = [...topicMap.entries()]
          .map(([topic, data]) => ({ topic, avg: data.totalScore / data.count }))
          .sort((a, b) => b.avg - a.avg);
        entries = sorted.slice(0, 10).map((t, i) => ({
          rank: i + 1, entityId: t.topic, entityLabel: t.topic,
          score: Math.round(t.avg), platform, metrics: {},
          reason: `Average performance score ${Math.round(t.avg)}/100`,
          attributes: { avgScore: t.avg },
        }));
        insight = `Best performing topics by average video score.`;
        break;
      }

      case RankingType.BEST_THUMBNAILS: {
        // Rank by CTR (CTR is the primary indicator of thumbnail effectiveness)
        const sorted = [...relevant].sort((a, b) =>
          b.platformAnalytics.normalizedMetrics.ctrPercent -
          a.platformAnalytics.normalizedMetrics.ctrPercent
        );
        entries = sorted.slice(0, 10).map((r, i) => ({
          rank: i + 1, entityId: r.platformAnalytics.platformVideoId,
          entityLabel: r.videoAnalytics.title,
          score: r.performanceScore.ctr, platform,
          metrics: { ctrPercent: r.platformAnalytics.normalizedMetrics.ctrPercent },
          reason: `CTR ${r.platformAnalytics.normalizedMetrics.ctrPercent.toFixed(1)}% — thumbnail style drives clicks`,
          attributes: { ctr: r.platformAnalytics.normalizedMetrics.ctrPercent },
        }));
        insight = `Thumbnails ranked by CTR — use these styles as templates.`;
        break;
      }

      case RankingType.BEST_HOOKS: {
        const sorted = [...relevant].sort((a, b) =>
          b.performanceScore.hook - a.performanceScore.hook
        );
        entries = sorted.slice(0, 10).map((r, i) => ({
          rank: i + 1, entityId: r.platformAnalytics.platformVideoId,
          entityLabel: r.videoAnalytics.title,
          score: r.performanceScore.hook, platform,
          metrics: { averageRetentionPercent: r.videoAnalytics.retentionGraph?.retentionAt30s ?? 0 },
          reason: `30s retention: ${r.videoAnalytics.retentionGraph?.retentionAt30s ?? 0}%`,
          attributes: { retentionAt30s: r.videoAnalytics.retentionGraph?.retentionAt30s },
        }));
        insight = `Top hooks by 30-second audience retention.`;
        break;
      }

      case RankingType.BEST_PUBLISHING_TIMES: {
        const timeMap = new Map<string, { totalViews: number; count: number }>();
        for (const r of relevant) {
          for (const hour of r.audienceAnalytics.bestHoursOfDay ?? []) {
            const key = `hour-${hour}`;
            const cur = timeMap.get(key) ?? { totalViews: 0, count: 0 };
            cur.totalViews += r.platformAnalytics.normalizedMetrics.views;
            cur.count++;
            timeMap.set(key, cur);
          }
        }
        const sorted = [...timeMap.entries()]
          .map(([key, data]) => ({ key, avg: data.totalViews / data.count }))
          .sort((a, b) => b.avg - a.avg);
        entries = sorted.slice(0, 5).map((t, i) => {
          const hour = parseInt(t.key.replace("hour-", ""));
          return {
            rank: i + 1, entityId: t.key,
            entityLabel: `${hour}:00 – ${hour + 1}:00`,
            score: Math.min(Math.round((t.avg / 100_000) * 100), 100),
            platform, metrics: {},
            reason: `Average ${Math.round(t.avg).toLocaleString()} views for videos published at this hour`,
            attributes: { hour, avgViews: t.avg },
          };
        });
        insight = `Best upload hours ranked by average views generated.`;
        break;
      }

      case RankingType.BEST_VIDEO_LENGTHS: {
        const buckets: Record<string, { total: number; count: number }> = {
          "0-60s": { total: 0, count: 0 },
          "1-5min": { total: 0, count: 0 },
          "5-15min": { total: 0, count: 0 },
          "15-30min": { total: 0, count: 0 },
          "30min+": { total: 0, count: 0 },
        };
        for (const r of relevant) {
          const dur = r.videoAnalytics.durationSeconds ?? 0;
          const key = dur < 60 ? "0-60s" : dur < 300 ? "1-5min" : dur < 900 ? "5-15min" : dur < 1800 ? "15-30min" : "30min+";
          buckets[key].total += r.performanceScore.overall;
          buckets[key].count++;
        }
        const sorted = Object.entries(buckets)
          .filter(([, v]) => v.count > 0)
          .map(([label, v]) => ({ label, avg: v.total / v.count }))
          .sort((a, b) => b.avg - a.avg);
        entries = sorted.map((b, i) => ({
          rank: i + 1, entityId: b.label, entityLabel: b.label,
          score: Math.round(b.avg), platform, metrics: {},
          reason: `Average performance score ${Math.round(b.avg)}/100`,
          attributes: { avgScore: b.avg },
        }));
        insight = `Video length buckets ranked by average performance score.`;
        break;
      }

      default: {
        entries = [];
        insight = `Ranking type "${type}" computed with available data.`;
      }
    }

    return {
      id:          `ranking-${type.toLowerCase()}-${Date.now()}`,
      type,
      platform,
      entries,
      generatedAt: new Date(),
      windowDays,
      insight,
    };
  }
}
