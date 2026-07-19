import { ObservabilityState } from "./ObservabilityState";
import { LogLevel } from "./LogLevel";
import { LogCategory } from "./LogCategory";
import { MetricType } from "./MetricType";
import { TraceStatus } from "./TraceStatus";
import { AlertSeverity } from "./AlertSeverity";
import { ValidationResult } from "./ValidationResult";
import { ObservabilityEventType } from "./ObservabilityEventType";

// 1. ObservabilityConfiguration
export interface ObservabilityConfiguration {
  environment: string;
  logFileDirectory: string;
  maxLogFileSizeMb: number;
  cpuThresholdPercent: number;
  memoryThresholdPercent: number;
  alertEmails: string[];
  enableMetricsCollection: boolean;
}

// 2. LogEntry
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: LogCategory;
  message: string;
  context?: Record<string, any>;
}

// 3. LogQuery
export interface LogQuery {
  level?: LogLevel;
  category?: LogCategory;
  startTime?: Date;
  endTime?: Date;
  keyword?: string;
}

// 4. LogQueryResult
export interface LogQueryResult {
  logs: LogEntry[];
  totalCount: number;
}

// 5. MetricEntry
export interface MetricEntry {
  timestamp: Date;
  type: MetricType;
  value: number;
  metadata?: Record<string, any>;
}

// 6. MetricQuery
export interface MetricQuery {
  type: MetricType;
  startTime?: Date;
  endTime?: Date;
}

// 7. MetricQueryResult
export interface MetricQueryResult {
  metrics: MetricEntry[];
  averageValue: number;
}

// 8. TraceSpan
export interface TraceSpan {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: Date;
  endTime?: Date;
  status: TraceStatus;
  tags?: Record<string, string>;
}

// 9. TraceReport
export interface TraceReport {
  traceId: string;
  rootSpan: TraceSpan;
  childSpans: TraceSpan[];
  totalDurationMs: number;
}

// 10. AlertEntry
export interface AlertEntry {
  id: string;
  timestamp: Date;
  severity: AlertSeverity;
  ruleName: string;
  message: string;
  resolved: boolean;
}

// 11. AlertRule
export interface AlertRule {
  name: string;
  metricType: MetricType;
  threshold: number;
  severity: AlertSeverity;
  enabled: boolean;
}

// 12. SystemResourceMetrics
export interface SystemResourceMetrics {
  cpuPercent: number;
  memoryUsedBytes: number;
  memoryTotalBytes: number;
  diskUsedPercent: number;
}

// 13. TokenUsageMetrics
export interface TokenUsageMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// 14. ApiCostMetrics
export interface ApiCostMetrics {
  costUsd: number;
  currency: string;
}

// 15. ExecutionTimelineEvent
export interface ExecutionTimelineEvent {
  id: string;
  timestamp: Date;
  activityName: string;
  durationMs: number;
  error?: string;
}

// 16. ExceptionTrackingEntry
export interface ExceptionTrackingEntry {
  timestamp: Date;
  errorName: string;
  errorMessage: string;
  stackTrace: string;
  engineId: string;
}

// 17. CrashReport
export interface CrashReport {
  id: string;
  timestamp: Date;
  crashCause: string;
  heapSnapshotPath?: string;
}

// 18. RecoveryReport
export interface RecoveryReport {
  crashId: string;
  timestamp: Date;
  rebootSuccessful: boolean;
  recoveryDurationMs: number;
}

// 19. RetryHistoryEntry
export interface RetryHistoryEntry {
  activityId: string;
  attemptNumber: number;
  timestamp: Date;
  delayMs: number;
  error: string;
}

// 20. DashboardIntegrationSnapshot
export interface DashboardIntegrationSnapshot {
  updatedAt: Date;
  recentLogs: LogEntry[];
  cpuTrend: number[];
  memoryTrend: number[];
  alertCount: number;
}

// 21. ObservabilitySnapshot
export interface ObservabilitySnapshot {
  state: ObservabilityState;
  configuration: ObservabilityConfiguration;
  timestamp: Date;
}

// 22. ObservabilityStateSnapshot
export interface ObservabilityStateSnapshot {
  state: ObservabilityState;
  timestamp: Date;
}

// 23. ArchiveReport
export interface ArchiveReport {
  archivedAt: Date;
  archivePath: string;
  compressedSizeKb: number;
}

// 24. ObservabilitySummary
export interface ObservabilitySummary {
  uptimeMs: number;
  logsCount: number;
  metricsCollectedCount: number;
  triggeredAlertsCount: number;
}
