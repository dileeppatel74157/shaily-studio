import { IABTestEngine }      from "./optimization-interfaces";
import { ABTest, ABTestResult, ABTestVariant } from "./optimization-models";
import { ABTestStatus }        from "./ABTestStatus";
import { NormalizedMetrics }   from "./models";
import { AnalyticsRecommendation } from "./models";
import { RecommendationType }  from "./RecommendationType";
import { MetricType }          from "./MetricType";

export class DefaultABTestEngine implements IABTestEngine {
  private readonly _tests = new Map<string, ABTest>();

  public createTest(test: ABTest): void {
    if (this._tests.has(test.id)) return; // idempotent
    this._tests.set(test.id, { ...test, status: ABTestStatus.RUNNING });
  }

  public updateTest(testId: string, metricsList: Partial<NormalizedMetrics>[]): void {
    const test = this._tests.get(testId);
    if (!test) return;
    test.variants.forEach((variant, i) => {
      const m = metricsList[i];
      if (!m) return;
      variant.views       = m.views ?? variant.views;
      variant.ctrPercent  = m.ctrPercent ?? variant.ctrPercent;
      variant.retentionPercent = m.averageRetentionPercent ?? variant.retentionPercent;
      variant.impressions = m.impressions ?? variant.impressions;
      variant.clicks      = Math.round((m.ctrPercent ?? 0) / 100 * (m.impressions ?? 0));
      variant.score       = this._scoreVariant(variant);
    });
  }

  public evaluate(): ABTestResult[] {
    const results: ABTestResult[] = [];
    for (const test of this._tests.values()) {
      if (test.status !== ABTestStatus.RUNNING) continue;

      const minViews = test.minViewsThreshold ?? 500;
      const allHaveEnoughData = test.variants.every(v => v.views >= minViews);

      if (!allHaveEnoughData) continue;

      const sorted = [...test.variants].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      const winner  = sorted[0];
      const control = sorted[sorted.length - 1];

      winner.isWinner = true;
      test.winnerId   = winner.id;
      test.status     = ABTestStatus.WINNER_FOUND;
      test.endedAt    = new Date();

      const ctrLift        = winner.ctrPercent - control.ctrPercent;
      const retentionLift  = winner.retentionPercent - control.retentionPercent;
      const viewsLift      = control.views > 0 ? ((winner.views - control.views) / control.views) * 100 : 0;
      const confidence      = Math.min(0.95, 0.5 + (allHaveEnoughData ? 0.3 : 0) + (Math.abs(ctrLift) > 1 ? 0.15 : 0));

      const recs: AnalyticsRecommendation[] = [];
      if (ctrLift > 0.5) {
        recs.push({
          id: `abtest-rec-${test.id}`, type: RecommendationType.THUMBNAIL,
          priority: "HIGH",
          title: `Apply winning ${test.variable.toLowerCase()} from A/B test`,
          description: `Variant "${winner.label}" outperformed by ${ctrLift.toFixed(1)}% CTR.`,
          expectedImpactPercent: Math.round(Math.abs(ctrLift) * 5),
          targetMetric: MetricType.CTR,
          evidence: `A/B test "${test.name}" ran for ${test.durationDays} days.`,
          action: `APPLY_VARIANT_${winner.label.toUpperCase()}`,
          parameters: { variantId: winner.id, content: winner.content },
        });
      }

      results.push({
        testId:          test.id,
        status:          ABTestStatus.WINNER_FOUND,
        winnerId:        winner.id,
        winnerLabel:     winner.label,
        winnerContent:   winner.content,
        ctrLift,
        retentionLift,
        viewsLift,
        confidence,
        insight: `"${winner.label}" wins: +${ctrLift.toFixed(1)}% CTR, +${retentionLift.toFixed(1)}% retention vs control.`,
        recommendations: recs,
        completedAt: new Date(),
      });
    }
    return results;
  }

  public getTest(testId: string): ABTest | undefined {
    return this._tests.get(testId);
  }

  public listTests(): ABTest[] {
    return [...this._tests.values()];
  }

  private _scoreVariant(v: ABTestVariant): number {
    return Math.round(v.ctrPercent * 10 * 0.4 + v.retentionPercent * 0.4 + Math.min(v.views / 1000, 100) * 0.2);
  }
}
