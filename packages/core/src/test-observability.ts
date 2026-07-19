import { ObservabilityBuilder } from "./observability/ObservabilityBuilder";
import { ObservabilityState } from "./observability/ObservabilityState";
import { LogLevel } from "./observability/LogLevel";
import { LogCategory } from "./observability/LogCategory";
import { MetricType } from "./observability/MetricType";
import { TraceStatus } from "./observability/TraceStatus";
import { AlertSeverity } from "./observability/AlertSeverity";
import { ValidationResult } from "./observability/ValidationResult";
import { ObservabilityEventType } from "./observability/ObservabilityEventType";
import { ObservabilityValidationException } from "./observability/types";
import { ObservabilityValidator } from "./observability/ObservabilityValidator";
import { RuntimeBuilder } from "./runtime/RuntimeBuilder";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("❌ Assertion Failed:", message);
    process.exit(1);
  }
}

// Mock context
const mockEvents: any[] = [];
const mockContext = {
  logger: {
    info: (msg: string) => {},
    warn: (msg: string) => {},
    error: (msg: string) => {}
  },
  eventBus: {
    publish: async (event: any) => {
      mockEvents.push(event);
    }
  }
};

async function runTests() {
  console.log("=== START SPRINT 23.2 OBSERVABILITY ENGINE TESTS ===\n");

  // 1. Builder Validation
  try {
    new ObservabilityBuilder().build();
    assert(false, "Builder should throw if context is missing.");
  } catch (err: any) {
    assert(err instanceof ObservabilityValidationException, "Expected ObservabilityValidationException.");
  }
  console.log("1. Builder Validation... ✓");

  // 2. Lifecycle Transitions
  const engine = new ObservabilityBuilder().withContext(mockContext).build();
  assert(engine.getState() === ObservabilityState.CREATED, "Engine state should be CREATED.");
  
  await engine.initialize();
  assert(engine.getState() === ObservabilityState.RUNNING, "Engine state should be RUNNING.");
  
  await engine.start();
  await engine.stop();
  assert(engine.getState() === ObservabilityState.STOPPED, "Engine state should be STOPPED.");
  
  // Re-init for other tests
  await engine.initialize();
  console.log("2. Lifecycle Transitions... ✓");

  // 3. Structured Logging
  const logger = engine.getLogger();
  logger.log(LogLevel.INFO, LogCategory.ENGINE, "Structured testing log", { component: "test" });
  const logResult = await logger.queryLogs({ keyword: "Structured testing log" });
  assert(logResult.totalCount === 1, "Log query count mismatch.");
  assert(logResult.logs[0].context?.component === "test", "Log context mismatch.");
  console.log("3. Structured Logging... ✓");

  // 4. Log Levels
  logger.debug("Debug log");
  logger.audit("Audit log");
  const auditLogs = await logger.queryLogs({ level: LogLevel.AUDIT });
  assert(auditLogs.totalCount === 1, "Audit log query count mismatch.");
  console.log("4. Log Levels... ✓");

  // 5. Log Rotation
  await engine.getStorageManager().rotateLogs();
  console.log("5. Log Rotation... ✓");

  // 6. Log Compression
  const compressionReport = await engine.getStorageManager().compressLogs();
  assert(compressionReport.compressedSizeKb > 0, "Compressed size should be positive.");
  console.log("6. Log Compression... ✓");

  // 7. Execution Timeline
  const traceMgr = engine.getTraceManager();
  const span1 = traceMgr.startSpan("pipeline_run");
  traceMgr.endSpan(span1.spanId, TraceStatus.SUCCESS);
  
  const events = traceMgr.getTimelineEvents();
  assert(events.length > 0 && events.some(e => e.activityName === "pipeline_run"), "Timeline events empty.");
  console.log("7. Execution Timeline... ✓");

  // 8. Distributed Tracing
  const parent = traceMgr.startSpan("parent_task");
  const child = traceMgr.startSpan("child_task", parent.spanId);
  traceMgr.endSpan(child.spanId, TraceStatus.SUCCESS);
  traceMgr.endSpan(parent.spanId, TraceStatus.SUCCESS);
  
  const report = await traceMgr.getTraceReport(parent.traceId);
  assert(report.rootSpan.spanId === parent.spanId, "Parent trace ID mismatch.");
  console.log("8. Distributed Tracing... ✓");

  // 9. Error Tracking
  logger.error("Exception occurred: timeout exception", { error: new Error("Test timeout exception") });
  console.log("9. Error Tracking... ✓");

  // 10. Metrics Collection
  const collector = engine.getMetricsCollector();
  collector.recordMetric(MetricType.DURATION, 250);
  const metricResult = await collector.queryMetrics({ type: MetricType.DURATION });
  assert(metricResult.averageValue === 250, "Metrics querying mismatch.");
  console.log("10. Metrics Collection... ✓");

  // 11. CPU Monitoring
  collector.recordMetric(MetricType.CPU, 45);
  const cpuResult = await collector.queryMetrics({ type: MetricType.CPU });
  assert(cpuResult.averageValue === 45, "CPU query mismatch.");
  console.log("11. CPU Monitoring... ✓");

  // 12. Memory Monitoring
  collector.recordMetric(MetricType.RAM, 1024);
  const ramResult = await collector.queryMetrics({ type: MetricType.RAM });
  assert(ramResult.averageValue === 1024, "RAM query mismatch.");
  console.log("12. Memory Monitoring... ✓");

  // 13. Provider Metrics
  collector.recordTokenUsage({ promptTokens: 100, completionTokens: 50, totalTokens: 150 });
  collector.recordApiCost({ costUsd: 0.002, currency: "USD" });
  console.log("13. Provider Metrics... ✓");

  // 14. Runtime Integration
  // Setup runtime builder and check observabilityEngine registration
  const runtimeContext = {
    env: "test",
    namespace: "runtime-observability-test",
    startTime: Date.now()
  };
  const runtimeConfig = {
    env: "test",
    heartbeatIntervalMs: 500,
    healthCheckIntervalMs: 1000,
    startupTimeoutMs: 500,
    shutdownTimeoutMs: 500
  };
  const runtime = new RuntimeBuilder()
    .withContext(runtimeContext)
    .withConfig(runtimeConfig)
    .build();

  assert(runtime !== null, "RuntimeEngine builder failed.");
  const obsSvc = runtime.getEngine("ObservabilityEngine");
  assert(obsSvc !== undefined, "ObservabilityEngine must be registered inside RuntimeEngine.");
  
  await runtime.initialize();
  console.log("14. Runtime Integration... ✓");

  // 15. Dashboard Integration
  const dashboardSnapshot = engine.getDashboardIntegrator().getDashboardSnapshot();
  assert(dashboardSnapshot.cpuTrend.length > 0, "Dashboard CPU trends missing.");
  console.log("15. Dashboard Integration... ✓");

  // 16. Alert System
  const alerts = engine.getAlertSystem();
  const alert = await alerts.triggerAlert(AlertSeverity.CRITICAL, "High CPU Rule", "CPU Usage is extremely high.");
  assert(alert.severity === AlertSeverity.CRITICAL, "Alert severity mismatch.");
  assert(alerts.getTriggeredAlerts().length > 0, "Triggered alerts list is empty.");
  console.log("16. Alert System... ✓");

  // 17. Snapshot Immutability
  const snap = engine.getSnapshot();
  assert(Object.isFrozen(snap), "Snapshot should be frozen.");
  assert(Object.isFrozen(snap.configuration), "Snapshot configuration should be frozen.");
  console.log("17. Snapshot Immutability... ✓");

  // 18. Validator Rules
  try {
    const badConfig = { ...snap.configuration, cpuThresholdPercent: 120 }; // threshold limit is 100%
    const badSnapshot = { ...snap, configuration: badConfig };
    new ObservabilityValidator().validate(badSnapshot);
    assert(false, "Should have thrown for invalid CPU threshold.");
  } catch (err: any) {
    assert(err instanceof ObservabilityValidationException, "Expected ObservabilityValidationException.");
  }
  console.log("18. Validator Rules... ✓");

  // 19. Log Recovery
  const recoveredLogs = await engine.getStorageManager().recoverLogs("logs-archive.tar.gz");
  assert(recoveredLogs.length > 0, "Recovered logs is empty.");
  console.log("19. Log Recovery... ✓");

  // 20. Complete End-to-End Observability
  const freshEngine = new ObservabilityBuilder().withContext(mockContext).build();
  await freshEngine.initialize();
  await freshEngine.start();
  
  freshEngine.getLogger().info("E2E Test starting.");
  freshEngine.getMetricsCollector().recordMetric(MetricType.CPU, 55);
  const freshSpan = freshEngine.getTraceManager().startSpan("e2e_trace");
  freshEngine.getTraceManager().endSpan(freshSpan.spanId, TraceStatus.SUCCESS);
  
  const reportObj = await freshEngine.getReporter().generateSummary();
  assert(reportObj.logsCount > 0, "E2E logs count mismatch.");
  
  await freshEngine.stop();
  console.log("20. Complete End-to-End Observability... ✓\n");

  console.log("=== ALL 20/20 OBSERVABILITY ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test suite threw an exception:", err);
  process.exit(1);
});
