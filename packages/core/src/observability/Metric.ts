import { MetricType } from "./MetricType";

export interface Metric {
  readonly name: string;
  readonly type: MetricType;
  readonly value: number;
  readonly timestamp: Date;
  readonly tags: Readonly<Record<string, string>>;
}
