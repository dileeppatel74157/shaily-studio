import { Metric } from "./Metric";
import { MetricType } from "./MetricType";
import { AggregatedMetric } from "./ObservabilitySnapshot";
import { ObservabilityValidator } from "./ObservabilityValidator";

export class MetricsCollector {
  private readonly _metrics: Metric[] = [];

  public record(metric: Metric): void {
    ObservabilityValidator.validateMetric(metric);
    this._metrics.push(metric);
  }

  public getRawMetrics(): readonly Metric[] {
    return [...this._metrics];
  }

  public getAggregatedMetrics(): readonly AggregatedMetric[] {
    const aggregates = new Map<string, {
      name: string;
      type: MetricType;
      count: number;
      sum: number;
      min: number;
      max: number;
      latest: number;
      tags: Record<string, string>;
    }>();

    for (const m of this._metrics) {
      const sortedTags = Object.keys(m.tags).sort().reduce((acc, key) => {
        acc[key] = m.tags[key];
        return acc;
      }, {} as Record<string, string>);
      
      const key = `${m.name}:${JSON.stringify(sortedTags)}`;
      const existing = aggregates.get(key);

      if (!existing) {
        aggregates.set(key, {
          name: m.name,
          type: m.type,
          count: 1,
          sum: m.value,
          min: m.value,
          max: m.value,
          latest: m.value,
          tags: { ...m.tags },
        });
      } else {
        existing.count += 1;
        existing.sum += m.value;
        existing.min = Math.min(existing.min, m.value);
        existing.max = Math.max(existing.max, m.value);
        existing.latest = m.value;
      }
    }

    return Array.from(aggregates.values()).map((agg) => ({
      name: agg.name,
      type: agg.type,
      count: agg.count,
      sum: agg.sum,
      min: agg.min,
      max: agg.max,
      latest: agg.latest,
      tags: agg.tags,
    }));
  }

  public clear(): void {
    this._metrics.length = 0;
  }
}
