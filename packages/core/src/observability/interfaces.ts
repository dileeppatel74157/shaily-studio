import { ObservabilityState } from "./ObservabilityState";
import { LogLevel } from "./LogLevel";
import { LogCategory } from "./LogCategory";
import { MetricType } from "./MetricType";
import { TraceStatus } from "./TraceStatus";
import { AlertSeverity } from "./AlertSeverity";
import {
  ObservabilityConfiguration,
  LogEntry,
  LogQuery,
  LogQueryResult,
  MetricEntry,
  MetricQuery,
  MetricQueryResult,
  TraceSpan,
  TraceReport,
  AlertEntry,
  AlertRule,
  SystemResourceMetrics,
  TokenUsageMetrics,
  ApiCostMetrics,
  ExecutionTimelineEvent,
  ExceptionTrackingEntry,
  CrashReport,
  RecoveryReport,
  DashboardIntegrationSnapshot,
  ObservabilitySnapshot,
  ArchiveReport,
  ObservabilitySummary
} from "./models";

export interface ILoggerService {
  log(level: LogLevel, category: LogCategory, message: string, context?: Record<string, any>): void;
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, context?: Record<string, any>): void;
  audit(message: string, context?: Record<string, any>): void;
  queryLogs(query: LogQuery): Promise<LogQueryResult>;
}

export interface IMetricsCollector {
  recordMetric(type: MetricType, value: number, metadata?: Record<string, any>): void;
  queryMetrics(query: MetricQuery): Promise<MetricQueryResult>;
  recordTokenUsage(metrics: TokenUsageMetrics): void;
  recordApiCost(metrics: ApiCostMetrics): void;
}

export interface ITraceManager {
  startSpan(operationName: string, parentSpanId?: string): TraceSpan;
  endSpan(spanId: string, status: TraceStatus): void;
  getTraceReport(traceId: string): Promise<TraceReport>;
  getTimelineEvents(): ExecutionTimelineEvent[];
}

export interface IAlertSystem {
  triggerAlert(severity: AlertSeverity, ruleName: string, message: string): Promise<AlertEntry>;
  getTriggeredAlerts(): AlertEntry[];
  resolveAlert(alertId: string): void;
  addAlertRule(rule: AlertRule): void;
}

export interface ILogStorageManager {
  writeLog(entry: LogEntry): Promise<void>;
  rotateLogs(): Promise<void>;
  compressLogs(): Promise<ArchiveReport>;
  recoverLogs(archivePath: string): Promise<LogEntry[]>;
}

export interface IResourceMonitor {
  getSystemMetrics(): Promise<SystemResourceMetrics>;
  checkThresholds(): Promise<void>;
}

export interface IDashboardIntegrator {
  getDashboardSnapshot(): DashboardIntegrationSnapshot;
  pushDashboardUpdates(): Promise<void>;
}

export interface IObservabilityValidator {
  validate(snapshot: ObservabilitySnapshot): void;
}

export interface IObservabilityReporter {
  generateSummary(): Promise<ObservabilitySummary>;
}

export interface IObservabilityEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  getState(): ObservabilityState;
  getSnapshot(): ObservabilitySnapshot;
  
  getLogger(): ILoggerService;
  getMetricsCollector(): IMetricsCollector;
  getTraceManager(): ITraceManager;
  getAlertSystem(): IAlertSystem;
  getStorageManager(): ILogStorageManager;
  getResourceMonitor(): IResourceMonitor;
  getDashboardIntegrator(): IDashboardIntegrator;
  getValidator(): IObservabilityValidator;
  getReporter(): IObservabilityReporter;
}
