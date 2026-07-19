import { ObservabilityState } from "./ObservabilityState";
import { LogLevel } from "./LogLevel";
import { LogCategory } from "./LogCategory";
import { MetricType } from "./MetricType";
import { TraceStatus } from "./TraceStatus";
import { AlertSeverity } from "./AlertSeverity";
import { ObservabilityEventType } from "./ObservabilityEventType";
import {
  IObservabilityEngine,
  ILoggerService,
  IMetricsCollector,
  ITraceManager,
  IAlertSystem,
  ILogStorageManager,
  IResourceMonitor,
  IDashboardIntegrator,
  IObservabilityValidator,
  IObservabilityReporter
} from "./interfaces";
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
import { ObservabilityValidator } from "./ObservabilityValidator";
import { InvalidObservabilityStateException, ObservabilityException, deepFreeze } from "./types";

export class ObservabilityEngine implements
  IObservabilityEngine,
  ILoggerService,
  IMetricsCollector,
  ITraceManager,
  IAlertSystem,
  ILogStorageManager,
  IResourceMonitor,
  IDashboardIntegrator,
  IObservabilityValidator,
  IObservabilityReporter
{
  private _state: ObservabilityState = ObservabilityState.CREATED;
  private readonly _config: ObservabilityConfiguration;
  private readonly _validator = new ObservabilityValidator();
  
  private readonly _logs: LogEntry[] = [];
  private readonly _metrics: MetricEntry[] = [];
  private readonly _spans: TraceSpan[] = [];
  private readonly _alerts: AlertEntry[] = [];
  private readonly _alertRules: AlertRule[] = [];
  
  constructor(
    private readonly _context: any,
    config?: Partial<ObservabilityConfiguration>
  ) {
    this._config = {
      environment: config?.environment || "production",
      logFileDirectory: config?.logFileDirectory || "/workspace/logs",
      maxLogFileSizeMb: config?.maxLogFileSizeMb || 50,
      cpuThresholdPercent: config?.cpuThresholdPercent || 85,
      memoryThresholdPercent: config?.memoryThresholdPercent || 90,
      alertEmails: config?.alertEmails || ["admin@shaily.studio"],
      enableMetricsCollection: config?.enableMetricsCollection ?? true
    };
  }

  // --- IObservabilityEngine ---

  public async initialize(): Promise<void> {
    this.transitionState(ObservabilityState.INITIALIZING);
    try {
      this.validate(this.getSnapshot());
      
      // Default alert rules
      this.addAlertRule({ name: "High CPU Rule", metricType: MetricType.CPU, threshold: 85, severity: AlertSeverity.CRITICAL, enabled: true });
      this.addAlertRule({ name: "OOM Warning Rule", metricType: MetricType.RAM, threshold: 90, severity: AlertSeverity.FATAL, enabled: true });

      this.transitionState(ObservabilityState.RUNNING);
    } catch (err: any) {
      this.transitionState(ObservabilityState.FAILED);
      throw new ObservabilityException("ObservabilityEngine initialization failed.", err);
    }
  }

  public async start(): Promise<void> {
    if (this._state !== ObservabilityState.RUNNING) {
      throw new InvalidObservabilityStateException("start", this._state);
    }
    this._context.logger?.info("ObservabilityEngine running.");
  }

  public async stop(): Promise<void> {
    this.transitionState(ObservabilityState.STOPPING);
    this.transitionState(ObservabilityState.STOPPED);
    this._context.logger?.info("ObservabilityEngine stopped.");
  }

  public getState(): ObservabilityState {
    return this._state;
  }

  public getSnapshot(): ObservabilitySnapshot {
    const snap: ObservabilitySnapshot = {
      state: this._state,
      configuration: JSON.parse(JSON.stringify(this._config)),
      timestamp: new Date()
    };
    return deepFreeze(snap);
  }

  // --- Sub-manager Resolvers ---
  public getLogger(): ILoggerService { return this; }
  public getMetricsCollector(): IMetricsCollector { return this; }
  public getTraceManager(): ITraceManager { return this; }
  public getAlertSystem(): IAlertSystem { return this; }
  public getStorageManager(): ILogStorageManager { return this; }
  public getResourceMonitor(): IResourceMonitor { return this; }
  public getDashboardIntegrator(): IDashboardIntegrator { return this; }
  public getValidator(): IObservabilityValidator { return this; }
  public getReporter(): IObservabilityReporter { return this; }


  // --- ILoggerService ---

  public log(level: LogLevel, category: LogCategory, message: string, context?: Record<string, any>): void {
    this._validator.validateLogLevelMessage(message);
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      context
    };
    this._logs.push(entry);
    
    // Asynchronously write to storage and publish
    this.writeLog(entry).catch(() => {});
  }

  public debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, LogCategory.ENGINE, message, context);
  }

  public info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, LogCategory.ENGINE, message, context);
  }

  public warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, LogCategory.ENGINE, message, context);
  }

  public error(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, LogCategory.ENGINE, message, context);
  }

  public audit(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.AUDIT, LogCategory.AUDIT, message, context);
  }

  public async queryLogs(query: LogQuery): Promise<LogQueryResult> {
    let filtered = this._logs;
    if (query.level) filtered = filtered.filter(l => l.level === query.level);
    if (query.category) filtered = filtered.filter(l => l.category === query.category);
    if (query.keyword) filtered = filtered.filter(l => l.message.includes(query.keyword!));
    
    return {
      logs: filtered,
      totalCount: filtered.length
    };
  }


  // --- IMetricsCollector ---

  public recordMetric(type: MetricType, value: number, metadata?: Record<string, any>): void {
    this._metrics.push({
      timestamp: new Date(),
      type,
      value,
      metadata
    });
    this.publishEvent(ObservabilityEventType.METRIC_COLLECTED, { type, value }).catch(() => {});
  }

  public async queryMetrics(query: MetricQuery): Promise<MetricQueryResult> {
    let filtered = this._metrics.filter(m => m.type === query.type);
    const avg = filtered.length > 0
      ? filtered.reduce((acc, current) => acc + current.value, 0) / filtered.length
      : 0;
    return {
      metrics: filtered,
      averageValue: avg
    };
  }

  public recordTokenUsage(metrics: TokenUsageMetrics): void {
    this.recordMetric(MetricType.TOKEN_USAGE, metrics.totalTokens, {
      promptTokens: metrics.promptTokens,
      completionTokens: metrics.completionTokens
    });
  }

  public recordApiCost(metrics: ApiCostMetrics): void {
    this.recordMetric(MetricType.API_COST, metrics.costUsd);
  }


  // --- ITraceManager ---

  public startSpan(operationName: string, parentSpanId?: string): TraceSpan {
    const spanId = `span-${Math.random().toString(36).substr(2, 9)}`;
    const traceId = `trace-${Math.random().toString(36).substr(2, 9)}`;
    
    this._validator.validateSpan(operationName, spanId);
    
    const span: TraceSpan = {
      spanId,
      traceId,
      parentSpanId,
      operationName,
      startTime: new Date(),
      status: TraceStatus.STARTED
    };
    this._spans.push(span);
    return span;
  }

  public endSpan(spanId: string, status: TraceStatus): void {
    const span = this._spans.find(s => s.spanId === spanId);
    if (span) {
      span.endTime = new Date();
      span.status = status;
      this.publishEvent(ObservabilityEventType.TRACE_COMPLETED, { spanId, status }).catch(() => {});
    }
  }

  public async getTraceReport(traceId: string): Promise<TraceReport> {
    const spans = this._spans.filter(s => s.traceId === traceId);
    const rootSpan = spans.find(s => !s.parentSpanId) || spans[0];
    const duration = rootSpan && rootSpan.endTime
      ? rootSpan.endTime.getTime() - rootSpan.startTime.getTime()
      : 0;
      
    return {
      traceId,
      rootSpan,
      childSpans: spans.filter(s => s.spanId !== rootSpan?.spanId),
      totalDurationMs: duration
    };
  }

  public getTimelineEvents(): ExecutionTimelineEvent[] {
    return this._spans.map(s => ({
      id: s.spanId,
      timestamp: s.startTime,
      activityName: s.operationName,
      durationMs: s.endTime ? s.endTime.getTime() - s.startTime.getTime() : 0
    }));
  }


  // --- IAlertSystem ---

  public async triggerAlert(severity: AlertSeverity, ruleName: string, message: string): Promise<AlertEntry> {
    const alert: AlertEntry = {
      id: `alert-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      severity,
      ruleName,
      message,
      resolved: false
    };
    this._alerts.push(alert);
    await this.publishEvent(ObservabilityEventType.ALERT_TRIGGERED, alert);
    return alert;
  }

  public getTriggeredAlerts(): AlertEntry[] {
    return this._alerts;
  }

  public resolveAlert(alertId: string): void {
    const alert = this._alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
    }
  }

  public addAlertRule(rule: AlertRule): void {
    this._alertRules.push(rule);
  }


  // --- ILogStorageManager ---

  public async writeLog(entry: LogEntry): Promise<void> {
    // Simulate writes
  }

  public async rotateLogs(): Promise<void> {
    // Simulate rotation
  }

  public async compressLogs(): Promise<ArchiveReport> {
    return {
      archivedAt: new Date(),
      archivePath: `${this._config.logFileDirectory}/logs-archive.tar.gz`,
      compressedSizeKb: 145
    };
  }

  public async recoverLogs(archivePath: string): Promise<LogEntry[]> {
    return this._logs;
  }


  // --- IResourceMonitor ---

  public async getSystemMetrics(): Promise<SystemResourceMetrics> {
    return {
      cpuPercent: 45.4,
      memoryUsedBytes: 4 * 1024 * 1024 * 1024,
      memoryTotalBytes: 16 * 1024 * 1024 * 1024,
      diskUsedPercent: 28.5
    };
  }

  public async checkThresholds(): Promise<void> {
    const current = await this.getSystemMetrics();
    if (current.cpuPercent > this._config.cpuThresholdPercent) {
      await this.triggerAlert(AlertSeverity.CRITICAL, "High CPU Rule", "CPU Usage is extremely high.");
    }
  }


  // --- IDashboardIntegrator ---

  public getDashboardSnapshot(): DashboardIntegrationSnapshot {
    return {
      updatedAt: new Date(),
      recentLogs: this._logs.slice(-5),
      cpuTrend: [24, 45, 54, 45],
      memoryTrend: [40, 42, 43, 40],
      alertCount: this._alerts.length
    };
  }

  public async pushDashboardUpdates(): Promise<void> {
    // push update triggers
  }


  // --- IObservabilityValidator ---

  public validate(snapshot: ObservabilitySnapshot): void {
    this._validator.validate(snapshot);
  }


  // --- IObservabilityReporter ---

  public async generateSummary(): Promise<ObservabilitySummary> {
    return {
      uptimeMs: 120000,
      logsCount: this._logs.length,
      metricsCollectedCount: this._metrics.length,
      triggeredAlertsCount: this._alerts.length
    };
  }


  // --- Internal Helpers ---

  private transitionState(nextState: ObservabilityState) {
    this._validator.validateStateTransition(this._state, nextState);
    this._state = nextState;
  }

  private async publishEvent(type: ObservabilityEventType, payload: any): Promise<void> {
    const event = {
      id: `evt-${Math.random().toString(36).substr(2, 9)}`,
      name: type.toString(),
      timestamp: new Date(),
      correlationId: "cor-obs-04",
      source: "ObservabilityEngine",
      payload,
      metadata: {}
    };
    if (this._context.eventBus) {
      await this._context.eventBus.publish(event);
    }
  }
}
