import { ISnapshotScheduler }   from "./optimization-interfaces";
import { SnapshotSchedule, AnalyticsSnapshotEntry } from "./optimization-models";
import { SnapshotInterval }      from "./SnapshotInterval";
import { NormalizedMetrics, PerformanceScore } from "./models";

const INTERVAL_DURATION_MS: Record<SnapshotInterval, number> = {
  [SnapshotInterval.HOURLY]:   3_600_000,
  [SnapshotInterval.DAILY]:   86_400_000,
  [SnapshotInterval.WEEKLY]:  604_800_000,
  [SnapshotInterval.MONTHLY]: 2_592_000_000,
  [SnapshotInterval.LIFETIME]: Number.MAX_SAFE_INTEGER,
};

export class DefaultSnapshotScheduler implements ISnapshotScheduler {
  private readonly _schedules = new Map<string, SnapshotSchedule>();
  private readonly _snapshots = new Map<string, AnalyticsSnapshotEntry[]>();

  public register(schedule: SnapshotSchedule): void {
    const nextSnapshots: Partial<Record<SnapshotInterval, Date>> = {};
    const now = new Date();
    for (const interval of schedule.intervals) {
      nextSnapshots[interval] = new Date(now.getTime() + INTERVAL_DURATION_MS[interval]);
    }
    this._schedules.set(schedule.platformVideoId, { ...schedule, nextSnapshots, active: true });
  }

  public capture(
    platformVideoId: string,
    interval: SnapshotInterval,
    metrics: NormalizedMetrics,
    score: PerformanceScore
  ): AnalyticsSnapshotEntry {
    const now      = new Date();
    const windowMs = INTERVAL_DURATION_MS[interval];
    const entry: AnalyticsSnapshotEntry = {
      id:              `snap-${interval.toLowerCase()}-${platformVideoId}-${Date.now()}`,
      platformVideoId,
      platform:        "YOUTUBE" as any, // resolved at usage
      interval,
      metrics,
      score,
      capturedAt:      now,
      windowStart:     new Date(now.getTime() - (interval === SnapshotInterval.LIFETIME ? 0 : windowMs)),
      windowEnd:       now,
    };
    const existing = this._snapshots.get(platformVideoId) ?? [];
    existing.push(entry);
    this._snapshots.set(platformVideoId, existing);

    // Advance next snapshot time
    const schedule = this._schedules.get(platformVideoId);
    if (schedule?.nextSnapshots?.[interval] && interval !== SnapshotInterval.LIFETIME) {
      schedule.nextSnapshots[interval] = new Date(now.getTime() + windowMs);
    }

    return entry;
  }

  public getSnapshots(platformVideoId: string): AnalyticsSnapshotEntry[] {
    return this._snapshots.get(platformVideoId) ?? [];
  }

  public getDue(now = new Date()): SnapshotSchedule[] {
    return [...this._schedules.values()].filter(s =>
      s.active && Object.values(s.nextSnapshots).some(d => d && d <= now)
    );
  }
}
