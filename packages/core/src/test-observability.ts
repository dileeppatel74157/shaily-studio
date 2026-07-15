import { ObservabilityBuilder } from "./observability/ObservabilityBuilder";
import { ObservabilityContext } from "./observability/ObservabilityContext";
import { HealthMonitor } from "./observability/HealthMonitor";
import { HealthStatus } from "./observability/HealthStatus";
import { MetricType } from "./observability/MetricType";
import { Metric } from "./observability/Metric";
import { Span } from "./observability/Span";
import { ObservabilityValidator } from "./observability/ObservabilityValidator";
import {
  ObservabilityState,
  InvalidLifecycleTransitionException,
  ObservabilityValidationException,
} from "./observability/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START OBSERVABILITY FRAMEWORK VERIFICATION TESTS ===");

  const context: ObservabilityContext = {
    env: "production",
    namespace: "shaily",
    metadata: { version: "1.0.0" },
  };

  // ==========================================
  // 1. Builder Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("1. Running Builder Validation...");

  // Valid construction
  const obs = new ObservabilityBuilder()
    .withContext(context)
    .withMetadata({ debug: true })
    .build();
  assert(obs !== null, "Observability instance must be successfully constructed");

  // Invalid construction (missing context)
  try {
    new ObservabilityBuilder().build();
    throw new Error("Should have failed validation for missing context");
  } catch (err: unknown) {
    assert(
      err instanceof ObservabilityValidationException,
      "Expected ObservabilityValidationException for missing context"
    );
  }

  // Invalid construction (empty environment)
  try {
    new ObservabilityBuilder()
      .withContext({ env: "", namespace: "shaily", metadata: {} })
      .build();
    throw new Error("Should have failed validation for empty environment");
  } catch (err: unknown) {
    assert(
      err instanceof ObservabilityValidationException,
      "Expected ObservabilityValidationException for empty environment"
    );
  }

  // Invalid construction (empty namespace)
  try {
    new ObservabilityBuilder()
      .withContext({ env: "prod", namespace: "   ", metadata: {} })
      .build();
    throw new Error("Should have failed validation for empty namespace");
  } catch (err: unknown) {
    assert(
      err instanceof ObservabilityValidationException,
      "Expected ObservabilityValidationException for empty namespace"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified Builder Validation.");

  // ==========================================
  // 2. Lifecycle State Transitions
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("2. Running Lifecycle Transition Validation...");

  const testObs = new ObservabilityBuilder().withContext(context).build();

  // Initially in CREATED state. Telemetry operations and stats must fail.
  try {
    testObs.recordMetric({
      name: "test.metric",
      type: MetricType.COUNTER,
      value: 1,
      timestamp: new Date(),
      tags: {},
    });
    throw new Error("Should have prevented recording metrics in CREATED state");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidLifecycleTransitionException,
      "Expected InvalidLifecycleTransitionException for CREATED state"
    );
  }

  try {
    testObs.startSpan("test.span");
    throw new Error("Should have prevented starting span in CREATED state");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidLifecycleTransitionException,
      "Expected InvalidLifecycleTransitionException for CREATED state"
    );
  }

  try {
    testObs.health();
    throw new Error("Should have prevented health report query in CREATED state");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidLifecycleTransitionException,
      "Expected InvalidLifecycleTransitionException for CREATED state"
    );
  }

  // Transition: CREATED -> READY
  await testObs.initialize();

  // Try illegal transition: READY -> STOPPED
  try {
    await testObs.stop();
    throw new Error("Should have prevented transition READY -> STOPPED");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidLifecycleTransitionException,
      "Expected InvalidLifecycleTransitionException for READY -> STOPPED"
    );
  }

  // READY allows health checking
  const initHealth = testObs.health();
  assert(initHealth.isHealthy === true, "Default health should be healthy in READY state");

  // Transition: READY -> RUNNING
  await testObs.start();

  // Try illegal transition: RUNNING -> READY (or initialize)
  try {
    await testObs.initialize();
    throw new Error("Should have prevented transition RUNNING -> READY");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidLifecycleTransitionException,
      "Expected InvalidLifecycleTransitionException for RUNNING -> READY"
    );
  }

  // Transition: RUNNING -> STOPPED
  await testObs.stop();

  // Once stopped, check transitions are prevented
  try {
    await testObs.start();
    throw new Error("Should have prevented transition STOPPED -> RUNNING");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidLifecycleTransitionException,
      "Expected InvalidLifecycleTransitionException for STOPPED -> RUNNING"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified Lifecycle State Transition and exception rules.");

  // ==========================================
  // 3. Metrics Collection & Aggregation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("3. Running Metrics Collection & Aggregation Validation...");

  const runObs = new ObservabilityBuilder().withContext(context).build();
  await runObs.initialize();
  await runObs.start();

  const timestamp = new Date();

  // Record counter
  runObs.recordMetric({
    name: "http.requests",
    type: MetricType.COUNTER,
    value: 1,
    timestamp,
    tags: { route: "/api/v1/users" },
  });
  runObs.recordMetric({
    name: "http.requests",
    type: MetricType.COUNTER,
    value: 2,
    timestamp,
    tags: { route: "/api/v1/users" },
  });
  runObs.recordMetric({
    name: "http.requests",
    type: MetricType.COUNTER,
    value: 5,
    timestamp,
    tags: { route: "/api/v1/jobs" },
  });

  // Record gauge
  runObs.recordMetric({
    name: "memory.usage",
    type: MetricType.GAUGE,
    value: 1024,
    timestamp,
    tags: {},
  });
  runObs.recordMetric({
    name: "memory.usage",
    type: MetricType.GAUGE,
    value: 2048,
    timestamp,
    tags: {},
  });

  // Record histogram
  runObs.recordMetric({
    name: "response.size",
    type: MetricType.HISTOGRAM,
    value: 150,
    timestamp,
    tags: {},
  });
  runObs.recordMetric({
    name: "response.size",
    type: MetricType.HISTOGRAM,
    value: 350,
    timestamp,
    tags: {},
  });

  // Record timer
  runObs.recordMetric({
    name: "db.query.time",
    type: MetricType.TIMER,
    value: 12,
    timestamp,
    tags: {},
  });
  runObs.recordMetric({
    name: "db.query.time",
    type: MetricType.TIMER,
    value: 28,
    timestamp,
    tags: {},
  });

  const snapshot = runObs.snapshot();

  // Validate raw counts
  assert(snapshot.metrics.length === 9, "Should record 9 raw metrics");

  // Validate aggregation
  const aggregates = snapshot.aggregatedMetrics;
  assert(aggregates.length === 5, "Should aggregate into 5 metric streams");

  const httpUsers = aggregates.find(
    (a) => a.name === "http.requests" && a.tags.route === "/api/v1/users"
  );
  assert(httpUsers !== undefined, "Aggregated http.requests for users route must exist");
  assert(httpUsers!.count === 2, "Count should be 2");
  assert(httpUsers!.sum === 3, "Sum should be 3");
  assert(httpUsers!.min === 1, "Min should be 1");
  assert(httpUsers!.max === 2, "Max should be 2");
  assert(httpUsers!.latest === 2, "Latest should be 2");

  const memoryAgg = aggregates.find((a) => a.name === "memory.usage");
  assert(memoryAgg !== undefined, "Aggregated memory.usage must exist");
  assert(memoryAgg!.count === 2, "Count should be 2");
  assert(memoryAgg!.latest === 2048, "Latest memory.usage should be 2048");
  assert(memoryAgg!.min === 1024, "Min should be 1024");
  assert(memoryAgg!.max === 2048, "Max should be 2048");

  const queryAgg = aggregates.find((a) => a.name === "db.query.time");
  assert(queryAgg !== undefined, "Aggregated query.time must exist");
  assert(queryAgg!.count === 2, "Count should be 2");
  assert(queryAgg!.sum === 40, "Sum should be 40");
  assert(queryAgg!.min === 12, "Min should be 12");
  assert(queryAgg!.max === 28, "Max should be 28");
  assert(queryAgg!.latest === 28, "Latest should be 28");

  // eslint-disable-next-line no-console
  console.log("   ✓ Verified Counters, Gauges, Histograms, and Timers with aggregation.");

  // ==========================================
  // 4. Distributed Tracing
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("4. Running Distributed Tracing Validation...");

  // Start Root span
  const root = runObs.startSpan("user.login", undefined, "correlation-123", { userId: "user-9" });
  assert(root.name === "user.login", "Root span name matches");
  assert(root.context.correlationId === "correlation-123", "Root correlation ID matches");
  assert(!root.context.parentSpanId, "Root span should have no parent");

  // Child Span 1 (Auto-parenting to root)
  const child1 = runObs.startSpan("auth.validate");
  assert(child1.context.parentSpanId === root.id, "Child 1 must auto-parent to root");
  assert(child1.context.correlationId === "correlation-123", "Child 1 must inherit correlation ID");
  assert(child1.context.traceId === root.context.traceId, "Child 1 must share trace ID");

  await new Promise((resolve) => setTimeout(resolve, 15));
  runObs.endSpan(child1.id);

  // Child Span 2 (Explicit parent to root)
  const child2 = runObs.startSpan("session.create", root.id);
  assert(child2.context.parentSpanId === root.id, "Child 2 must parent to root");
  assert(child2.context.correlationId === "correlation-123", "Child 2 must inherit correlation ID");

  await new Promise((resolve) => setTimeout(resolve, 10));
  runObs.endSpan(child2.id);

  await new Promise((resolve) => setTimeout(resolve, 5));
  runObs.endSpan(root.id);

  const traceSnapshot = runObs.snapshot();
  assert(traceSnapshot.traces.length === 1, "Should record exactly 1 trace");
  
  const trace = traceSnapshot.traces[0];
  assert(trace.id === root.context.traceId, "Trace ID matches root span trace ID");
  assert(trace.correlationId === "correlation-123", "Trace correlation ID matches root");
  
  const activeRoot = trace.rootSpan;
  assert(activeRoot.childSpans.length === 2, "Root span has 2 children");
  assert(activeRoot.duration !== undefined && activeRoot.duration >= 30, "Duration calculated correctly");
  assert(activeRoot.endTime !== undefined, "Root span has end time");

  const traceChild1 = activeRoot.childSpans.find((c) => c.name === "auth.validate");
  assert(traceChild1 !== undefined, "Child 1 exists in hierarchy");
  assert(traceChild1!.duration !== undefined && traceChild1!.duration >= 14, "Child 1 duration meets bounds");

  // eslint-disable-next-line no-console
  console.log("   ✓ Verified parent/child spans, duration, trace context, and correlation IDs.");

  // ==========================================
  // 5. Health Monitoring
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("5. Running Health Monitoring Validation...");

  const monitor = new HealthMonitor();
  
  // Verify default healthy
  let report = monitor.generateReport();
  assert(report.isHealthy === true, "Initially healthy");
  assert(report.services.length === 9, "Monitors 9 standard services");

  // Update a service status to degraded
  monitor.recordHealth("Gateway", HealthStatus.DEGRADED, 120, { status: "degraded database" });
  report = monitor.generateReport();
  assert(report.isHealthy === true, "DEGRADED does not make whole system unhealthy");
  
  const gatewayHealth = report.services.find((s) => s.service === "Gateway");
  assert(gatewayHealth!.status === HealthStatus.DEGRADED, "Gateway degraded");
  assert(gatewayHealth!.latency === 120, "Gateway latency matches");
  assert(gatewayHealth!.metadata.status === "degraded database", "Gateway metadata matches");

  // Update a service status to unhealthy
  monitor.recordHealth("Orchestrator", HealthStatus.UNHEALTHY, 500);
  report = monitor.generateReport();
  assert(report.isHealthy === false, "UNHEALTHY service makes whole report unhealthy");

  const orchHealth = report.services.find((s) => s.service === "Orchestrator");
  assert(orchHealth!.status === HealthStatus.UNHEALTHY, "Orchestrator unhealthy");
  assert(orchHealth!.latency === 500, "Orchestrator latency matches");

  // eslint-disable-next-line no-console
  console.log("   ✓ Verified Service health updates, latencies, and diagnostic reporting.");

  // ==========================================
  // 6. Deep Immutability (Deep Freeze)
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("6. Running Deep Immutability Validation...");

  const immutabilityObs = new ObservabilityBuilder().withContext(context).build();
  await immutabilityObs.initialize();
  await immutabilityObs.start();

  immutabilityObs.recordMetric({
    name: "test.mut",
    type: MetricType.COUNTER,
    value: 1,
    timestamp: new Date(),
    tags: { env: "prod" },
  });

  const spanMut = immutabilityObs.startSpan("mut.span");
  immutabilityObs.endSpan(spanMut.id);

  const immSnapshot = immutabilityObs.snapshot();

  // Try mutating snapshot root
  try {
    (immSnapshot as any).timestamp = new Date(0);
    throw new Error("Should have thrown error on modifying snapshot root");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen snapshot root");
  }

  // Try mutating snapshot metrics
  try {
    (immSnapshot.metrics as any)[0] = null;
    throw new Error("Should have thrown error on modifying snapshot metrics array");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen snapshot metrics array");
  }

  // Try mutating metric tags
  try {
    (immSnapshot.metrics[0].tags as any).env = "hack";
    throw new Error("Should have thrown error on modifying frozen metric tags");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen metric tags");
  }

  // Try mutating trace span
  try {
    (spanMut as any).name = "hacked.span";
    throw new Error("Should have thrown error on modifying frozen span returned by startSpan");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen span");
  }

  try {
    (immSnapshot.traces[0].rootSpan.context as any).traceId = "hacked-id";
    throw new Error("Should have thrown error on modifying frozen trace rootSpan context");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen trace rootSpan context");
  }

  // eslint-disable-next-line no-console
  console.log("   ✓ Verified deep freeze immutability on snapshots, metrics, spans, and traces.");

  // ==========================================
  // 7. Validator Rules
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("7. Running Validator Rule Checks...");

  // Rule: Invalid Metric Names
  try {
    const invalidMetric: Metric = {
      name: "invalid name spaces",
      type: MetricType.COUNTER,
      value: 1,
      timestamp: new Date(),
      tags: {},
    };
    ObservabilityValidator.validateMetric(invalidMetric);
    throw new Error("Should have rejected metric name with spaces");
  } catch (err: unknown) {
    assert(
      err instanceof ObservabilityValidationException,
      "Expected ObservabilityValidationException for space in metric name"
    );
  }

  try {
    const invalidMetric: Metric = {
      name: "invalid@char",
      type: MetricType.COUNTER,
      value: 1,
      timestamp: new Date(),
      tags: {},
    };
    ObservabilityValidator.validateMetric(invalidMetric);
    throw new Error("Should have rejected metric name with special characters");
  } catch (err: unknown) {
    assert(
      err instanceof ObservabilityValidationException,
      "Expected ObservabilityValidationException for special character in metric name"
    );
  }

  // Rule: Invalid Health Reports (Unknown Service)
  try {
    const invalidMonitor = new HealthMonitor();
    invalidMonitor.recordHealth("UnknownService", HealthStatus.HEALTHY, 10);
    throw new Error("Should have rejected recording health for unsupported service");
  } catch (err: unknown) {
    assert(
      err instanceof ObservabilityValidationException,
      "Expected ObservabilityValidationException for unknown service health"
    );
  }

  // Rule: Invalid Health Reports (Negative Latency)
  try {
    const invalidMonitor = new HealthMonitor();
    invalidMonitor.recordHealth("Studio", HealthStatus.HEALTHY, -5);
    throw new Error("Should have rejected recording health with negative latency");
  } catch (err: unknown) {
    assert(
      err instanceof ObservabilityValidationException,
      "Expected ObservabilityValidationException for negative health check latency"
    );
  }

  // Rule: Invalid Span Hierarchy (Child start before parent start)
  const baseTime = new Date();
  const parentSpan: Span = {
    id: "p1",
    name: "parent",
    context: { traceId: "t1", spanId: "p1", correlationId: "c1" },
    startTime: new Date(baseTime.getTime() + 10),
    endTime: new Date(baseTime.getTime() + 20),
    tags: {},
    childSpans: [
      {
        id: "c1",
        name: "child",
        context: { traceId: "t1", spanId: "c1", parentSpanId: "p1", correlationId: "c1" },
        startTime: new Date(baseTime.getTime() + 5), // Starts before parent!
        endTime: new Date(baseTime.getTime() + 15),
        tags: {},
        childSpans: [],
      },
    ],
  };

  try {
    ObservabilityValidator.validateSpanHierarchy([parentSpan]);
    throw new Error("Should have rejected child span starting before parent");
  } catch (err: unknown) {
    assert(
      err instanceof ObservabilityValidationException,
      "Expected ObservabilityValidationException for child starting before parent"
    );
  }

  // Rule: Invalid Span Hierarchy (Child end after parent end)
  const parentSpan2: Span = {
    id: "p2",
    name: "parent",
    context: { traceId: "t2", spanId: "p2", correlationId: "c2" },
    startTime: new Date(baseTime.getTime()),
    endTime: new Date(baseTime.getTime() + 20),
    tags: {},
    childSpans: [
      {
        id: "c2",
        name: "child",
        context: { traceId: "t2", spanId: "c2", parentSpanId: "p2", correlationId: "c2" },
        startTime: new Date(baseTime.getTime() + 5),
        endTime: new Date(baseTime.getTime() + 25), // Ends after parent!
        tags: {},
        childSpans: [],
      },
    ],
  };

  try {
    ObservabilityValidator.validateSpanHierarchy([parentSpan2]);
    throw new Error("Should have rejected child span ending after parent");
  } catch (err: unknown) {
    assert(
      err instanceof ObservabilityValidationException,
      "Expected ObservabilityValidationException for child ending after parent"
    );
  }

  // Rule: Invalid Span Hierarchy (Duplicate Span IDs)
  const parentSpan3: Span = {
    id: "p3",
    name: "parent",
    context: { traceId: "t3", spanId: "p3", correlationId: "c3" },
    startTime: new Date(baseTime.getTime()),
    endTime: new Date(baseTime.getTime() + 20),
    tags: {},
    childSpans: [
      {
        id: "p3", // Duplicate ID!
        name: "child",
        context: { traceId: "t3", spanId: "p3", parentSpanId: "p3", correlationId: "c3" },
        startTime: new Date(baseTime.getTime() + 5),
        endTime: new Date(baseTime.getTime() + 15),
        tags: {},
        childSpans: [],
      },
    ],
  };

  try {
    ObservabilityValidator.validateSpanHierarchy([parentSpan3]);
    throw new Error("Should have rejected duplicate span IDs in tree");
  } catch (err: unknown) {
    assert(
      err instanceof ObservabilityValidationException,
      "Expected ObservabilityValidationException for duplicate span IDs"
    );
  }

  // Rule: Invalid Span Hierarchy (Cyclic Dependency)
  // Let's create an invalid cyclic structure manually
  const childSpan4: any = {
    id: "c4",
    name: "child",
    context: { traceId: "t4", spanId: "c4", parentSpanId: "p4", correlationId: "c4" },
    startTime: new Date(baseTime.getTime() + 5),
    endTime: new Date(baseTime.getTime() + 15),
    tags: {},
  };

  const parentSpan4: Span = {
    id: "p4",
    name: "parent",
    context: { traceId: "t4", spanId: "p4", correlationId: "c4" },
    startTime: new Date(baseTime.getTime()),
    endTime: new Date(baseTime.getTime() + 20),
    tags: {},
    childSpans: [childSpan4],
  };

  // Create cycles: child references parent, parent references child
  childSpan4.childSpans = [parentSpan4];

  try {
    ObservabilityValidator.validateSpanHierarchy([parentSpan4]);
    throw new Error("Should have rejected cyclic dependency in span hierarchy");
  } catch (err: unknown) {
    assert(
      err instanceof ObservabilityValidationException,
      "Expected ObservabilityValidationException for cycle in span hierarchy"
    );
  }

  // eslint-disable-next-line no-console
  console.log("   ✓ Verified Validator rules for metric names, health inputs, and span hierarchy.");

  // eslint-disable-next-line no-console
  console.log("=== ALL OBSERVABILITY FRAMEWORK VERIFICATION TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Test execution failed:", err);
  process.exit(1);
});
