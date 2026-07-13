import { Clock, SystemClock } from "./logger/Clock";
import { ConsoleTransport } from "./logger/ConsoleTransport";
import { LogEntry } from "./logger/LogEntry";
import { LogEntryFactory } from "./logger/LogEntryFactory";
import { JsonFormatter, PrettyConsoleFormatter } from "./logger/LogFormatter";
import { LogLevel } from "./logger/LogLevel";
import { LogMetadata } from "./logger/LogMetadata";
import { LogTransport } from "./logger/LogTransport";
import { LoggerBuilder } from "./logger/LoggerBuilder";
import { TransportFailureHandler, TransportPipeline } from "./logger/TransportPipeline";

class MockTransport implements LogTransport {
  public entries: LogEntry[] = [];

  public send(entry: LogEntry): void {
    this.entries.push(entry);
  }
}

class CrashingTransport implements LogTransport {
  public send(entry: LogEntry): void {
    throw new Error(`Intentional crash for entry ${entry.id}`);
  }
}

class TestFailureHandler implements TransportFailureHandler {
  public failures: Array<{ error: Error; entry: LogEntry; transport: LogTransport }> = [];

  public handleFailure(error: Error, entry: LogEntry, transport: LogTransport): void {
    this.failures.push({ error, entry, transport });
  }
}

class FixedClock implements Clock {
  private readonly _date: Date;
  constructor(date: Date) {
    this._date = date;
  }
  public now(): Date {
    return this._date;
  }
}

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START LOGGER INFRASTRUCTURE VERIFICATION TESTS ===");

  const mockTransport = new MockTransport();
  const prettyFormatter = new PrettyConsoleFormatter();
  const consoleTransport = new ConsoleTransport(prettyFormatter, true);

  // ==========================================
  // Test 1: Clock Abstraction Tests
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n1. Running Clock Abstraction Tests...");
  const systemClock = new SystemClock();
  assert(systemClock.now() instanceof Date, "SystemClock must return Date");

  const fixedDate = new Date("2026-07-13T12:00:00.000Z");
  const fixedClock = new FixedClock(fixedDate);
  assert(
    fixedClock.now().getTime() === fixedDate.getTime(),
    "FixedClock must return configured Date"
  );
  // eslint-disable-next-line no-console
  console.log("   ✓ Clock abstraction validated.");

  // ==========================================
  // Test 2: LogEntryFactory & Immutability Tests
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n2. Running LogEntryFactory & Immutability Tests...");
  const factory = new LogEntryFactory(fixedClock);
  const rawMeta = { user: "dileep", role: "admin" };
  const entry = factory.create(
    LogLevel.INFO,
    "Hello World",
    "AuthModule",
    { moduleName: "AuthModule" },
    rawMeta
  );

  assert(entry.timestamp.getTime() === fixedDate.getTime(), "Factory must read time from Clock");
  assert(entry.id.length === 36, "Factory must populate UUID");
  assert(entry.metadata instanceof LogMetadata, "Metadata normalized to LogMetadata instance");
  assert(entry.metadata.get("user") === "dileep", "Metadata keys preserved");

  // Verify immutability
  assert(Object.isFrozen(entry), "LogEntry object must be frozen");
  assert(Object.isFrozen(entry.context), "LoggerContext object must be frozen");
  assert(Object.isFrozen(entry.metadata.fields), "LogMetadata fields must be frozen");

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (entry as any).message = "Hack";
    throw new Error("Should have thrown error in strict mode when modifying frozen entry");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log("   ✓ Prevented mutation of frozen LogEntry correctly.");
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Factory and Immutability verified.");

  // ==========================================
  // Test 3: Correlation ID Support & Propagation Tests
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n3. Running Correlation ID Propagation Tests...");
  const rootBuilder = new LoggerBuilder()
    .withMinLevel(LogLevel.INFO)
    .addTransport(mockTransport)
    .withFormatter(prettyFormatter)
    .withModule("RootModule");

  const rootLogger = rootBuilder.build();
  rootLogger.info("Root log message");

  const rootEntry = mockTransport.entries[0];
  const rootCorrId = rootEntry.context.correlationId;
  assert(rootCorrId !== undefined, "Correlation ID must be auto-generated");
  assert(rootCorrId!.length === 36, "Correlation ID should be a valid UUID");

  // Child propagation
  const childLogger = rootLogger.child({ moduleName: "ChildModule", job: "generate-video" });
  childLogger.info("Child log message");

  const childEntry = mockTransport.entries[1];
  assert(
    childEntry.context.correlationId === rootCorrId,
    "Child logger must inherit correlationId"
  );
  assert(childEntry.context.job === "generate-video", "Child context appended");

  // Child override
  const childOverrideLogger = rootLogger.child({ correlationId: "override-id-999" });
  childOverrideLogger.info("Child override message");

  const childOverrideEntry = mockTransport.entries[2];
  assert(
    childOverrideEntry.context.correlationId === "override-id-999",
    "Child logger must support override"
  );
  // eslint-disable-next-line no-console
  console.log("   ✓ Correlation ID propagation and override verified.");

  // ==========================================
  // Test 4: Transport Pipeline & Isolation Tests
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n4. Running Transport Pipeline Failure Isolation Tests...");
  const pipelineTrans1 = new MockTransport();
  const pipelineTrans2 = new CrashingTransport();
  const pipelineTrans3 = new MockTransport();

  const pipeline = new TransportPipeline([pipelineTrans1, pipelineTrans2, pipelineTrans3]);
  const failHandler = new TestFailureHandler();
  pipeline.registerFailureHandler(failHandler);

  const pipelineEntry = factory.create(LogLevel.ERROR, "Pipeline testing", "System", {
    moduleName: "System",
  });
  pipeline.send(pipelineEntry);

  assert(pipelineTrans1.entries.length === 1, "Transport 1 must run successfully");
  assert(pipelineTrans3.entries.length === 1, "Transport 3 must run despite Transport 2 crash");
  assert(failHandler.failures.length === 1, "Pipeline must capture crash in failure handler");
  assert(
    failHandler.failures[0].error.message.includes("Intentional crash"),
    "Crash message matches"
  );
  assert(failHandler.failures[0].entry === pipelineEntry, "Failed entry preserved");
  assert(failHandler.failures[0].transport === pipelineTrans2, "Crashing transport reported");
  // eslint-disable-next-line no-console
  console.log("   ✓ Pipeline isolated transport failures and processed remaining queue.");

  // ==========================================
  // Test 5: Formatters & Nested Cause Serialization Tests
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n5. Running Error Cause Serialization Tests...");
  const innerError = new Error("Database timeout");
  const testError = new Error("Failed to process transaction", { cause: innerError });

  const rootLoggerWithConsole = new LoggerBuilder()
    .withMinLevel(LogLevel.INFO)
    .addTransport(mockTransport)
    .addTransport(consoleTransport)
    .withFormatter(prettyFormatter)
    .withModule("TransactionModule")
    .build();

  rootLoggerWithConsole.error("Db error", {}, testError);

  const errorEntry = mockTransport.entries[mockTransport.entries.length - 1];
  const jsonFormatter = new JsonFormatter();
  const jsonOutput = jsonFormatter.format(errorEntry);
  const parsedJson = JSON.parse(jsonOutput);

  assert(
    parsedJson.error.message === "Failed to process transaction",
    "JSON Error message matches"
  );
  assert(parsedJson.error.cause.message === "Database timeout", "Nested Error cause matches");
  // eslint-disable-next-line no-console
  console.log("   ✓ Nested error cause serialized to JSON accurately.");

  // eslint-disable-next-line no-console
  console.log("\n=== ALL LOGGER INFRASTRUCTURE VERIFICATION TESTS PASSED SUCCESSFULLY ===");
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

runTests().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Test execution failed:", err);
  process.exit(1);
});
