import { ConsoleTransport } from "./logger/ConsoleTransport";
import { JsonFormatter, PrettyConsoleFormatter } from "./logger/LogFormatter";
import { LogEntry } from "./logger/LogEntry";
import { LogLevel } from "./logger/LogLevel";
import { LogTransport } from "./logger/LogTransport";
import { LoggerBuilder } from "./logger/LoggerBuilder";

class MockTransport implements LogTransport {
  public entries: LogEntry[] = [];

  public send(entry: LogEntry): void {
    this.entries.push(entry);
  }
}

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START LOGGER INFRASTRUCTURE VERIFICATION TESTS ===");

  const mockTransport = new MockTransport();
  const prettyFormatter = new PrettyConsoleFormatter();
  const consoleTransport = new ConsoleTransport(prettyFormatter, true);

  // 1. Fluid Builder Configuration
  // eslint-disable-next-line no-console
  console.log("1. Building Logger via LoggerBuilder...");
  const builder = new LoggerBuilder()
    .withMinLevel(LogLevel.INFO)
    .addTransport(mockTransport)
    .addTransport(consoleTransport)
    .withFormatter(prettyFormatter)
    .withModule("TestModule")
    .withKernelId("mock-kernel-id-123");

  const logger = builder.build();

  // 2. Log Level Filtering Tests
  // eslint-disable-next-line no-console
  console.log("2. Running Log Level Filtering Tests...");
  logger.trace("Trace log - should be filtered");
  logger.debug("Debug log - should be filtered");
  logger.info("Info log - should pass");
  logger.warn("Warn log - should pass");
  logger.error("Error log - should pass");
  logger.fatal("Fatal log - should pass");

  assert(
    mockTransport.entries.length === 4,
    "Filtered logs: only 4 entries should be received (INFO, WARN, ERROR, FATAL)"
  );
  assert(mockTransport.entries[0].level === LogLevel.INFO, "First entry level should be INFO");
  assert(mockTransport.entries[1].level === LogLevel.WARN, "Second entry level should be WARN");
  assert(mockTransport.entries[2].level === LogLevel.ERROR, "Third entry level should be ERROR");
  assert(mockTransport.entries[3].level === LogLevel.FATAL, "Fourth entry level should be FATAL");
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified log levels filter correctly.");

  // 3. Metadata & Context Tests
  // eslint-disable-next-line no-console
  console.log("3. Running Metadata & Context Tests...");
  const metadata = { userId: "user-456", action: "test-run" };
  logger.info("Checking metadata payload", metadata);

  const metaEntry = mockTransport.entries[4];
  assert(metaEntry.message === "Checking metadata payload", "Message match");
  assert(metaEntry.metadata !== undefined, "Metadata exists");
  assert(metaEntry.metadata!.userId === "user-456", "Metadata userId matches");
  assert(metaEntry.context.moduleName === "TestModule", "Context module name matches");
  assert(metaEntry.context.kernelId === "mock-kernel-id-123", "Context kernelId matches");
  // eslint-disable-next-line no-console
  console.log("   ✓ Metadata & root context mapped successfully.");

  // 4. Child Logger Inheritance Tests
  // eslint-disable-next-line no-console
  console.log("4. Running Child Logger Context Inheritance Tests...");
  const childLogger = logger.child({ jobId: "job-999", moduleName: "SubModule" });
  childLogger.info("Child log message");

  const childEntry = mockTransport.entries[5];
  assert(childEntry.context.moduleName === "SubModule", "Child context moduleName overwritten");
  assert(childEntry.context.kernelId === "mock-kernel-id-123", "Child inherited kernelId");
  assert(childEntry.context.jobId === "job-999", "Child context jobId added");
  // eslint-disable-next-line no-console
  console.log("   ✓ Child logger inherited and extended context successfully.");

  // 5. Error Logging & Serialization Tests
  // eslint-disable-next-line no-console
  console.log("5. Running Error Logging & Serialization Tests...");
  const innerError = new Error("Database timeout");
  const testError = new Error("Failed to process transaction", { cause: innerError });

  logger.error("Transaction error occurred", undefined, testError);

  const errEntry = mockTransport.entries[6];
  assert(errEntry.error !== undefined, "Error payload attached");
  assert(errEntry.error!.message === "Failed to process transaction", "Error message matches");
  assert(errEntry.error!.stack !== undefined, "Error stack exists");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert((errEntry.error as any).cause === innerError, "Error cause matches inner error");

  // Formatters check
  const jsonFormatter = new JsonFormatter();
  const jsonOutput = jsonFormatter.format(errEntry);
  const parsedJson = JSON.parse(jsonOutput);

  assert(parsedJson.message === "Transaction error occurred", "JSON message matches");
  assert(parsedJson.error.message === "Failed to process transaction", "JSON serialized error message matches");
  assert(parsedJson.error.stack !== undefined, "JSON serialized error stack matches");
  assert(parsedJson.error.cause.message === "Database timeout", "JSON serialized error cause matches");
  // eslint-disable-next-line no-console
  console.log("   ✓ Error stack and nested cause serialized correctly.");

  // eslint-disable-next-line no-console
  console.log("=== ALL LOGGER INFRASTRUCTURE VERIFICATION TESTS PASSED SUCCESSFULLY ===");
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
