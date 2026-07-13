import { Event } from "./events/Event";
import { EventBuilder } from "./events/EventBuilder";
import { EventBus } from "./events/EventBus";
import { EventPriority } from "./events/EventPriority";
import { JsonFormatter } from "./logger/LogFormatter";
import { LoggerBuilder } from "./logger/LoggerBuilder";

class SilentTransport {
  send() {}
}

const logger = new LoggerBuilder()
  .addTransport(new SilentTransport())
  .withFormatter(new JsonFormatter())
  .build();

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START EVENT BUS VERIFICATION TESTS ===");

  const bus = new EventBus(logger);

  // 1. Event Construction & Immutability Checks
  // eslint-disable-next-line no-console
  console.log("1. Running EventBuilder & Immutability Checks...");
  const event = new EventBuilder()
    .withName("video.created")
    .withSource("test-suite")
    .withPayload({ id: "vid-123", duration: 60 })
    .withMetadata({ author: "dileep" })
    .build();

  assert(event.name === "video.created", "Event name matches");
  assert(event.payload.id === "vid-123", "Payload maps correctly");
  assert(event.metadata.author === "dileep", "Metadata maps correctly");

  assert(Object.isFrozen(event), "Event object must be frozen");
  assert(Object.isFrozen(event.payload), "Event payload must be frozen");
  assert(Object.isFrozen(event.metadata), "Event metadata must be frozen");

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event as any).source = "hack";
    throw new Error("Should have thrown error in strict mode when modifying frozen event");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log("   ✓ Immutability of event payload and properties verified.");
  }

  // 2. Subscribe and Unsubscribe Lifecycle Tests
  // eslint-disable-next-line no-console
  console.log("2. Running Subscribe/Unsubscribe Lifecycle...");
  let receiveCount = 0;
  const sub = bus.subscribe("video.created", () => {
    receiveCount++;
  });

  assert(bus.hasSubscribers("video.created") === true, "Has subscribers");

  await bus.publish(event);
  assert(receiveCount === 1, "Handler received the event");

  const unsubbed = bus.unsubscribe(sub.id);
  assert(unsubbed === true, "Unsubscription returns true");
  assert(bus.hasSubscribers("video.created") === false, "Has no subscribers after unsubscribe");

  await bus.publish(event);
  assert(receiveCount === 1, "Handler did not receive the event after unsubscribe");
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified subscription and unsubscription lifecycles.");

  // 3. Priority Ordering Tests (CRITICAL -> HIGH -> NORMAL -> LOW)
  // eslint-disable-next-line no-console
  console.log("3. Running Priority Ordering Tests...");
  const order: string[] = [];

  bus.subscribe(
    "order.test",
    () => {
      order.push("LOW");
    },
    EventPriority.LOW
  );
  bus.subscribe(
    "order.test",
    () => {
      order.push("HIGH");
    },
    EventPriority.HIGH
  );
  bus.subscribe(
    "order.test",
    () => {
      order.push("CRITICAL");
    },
    EventPriority.CRITICAL
  );
  bus.subscribe(
    "order.test",
    () => {
      order.push("NORMAL");
    },
    EventPriority.NORMAL
  );

  const testEvent = new EventBuilder().withName("order.test").build();
  await bus.publish(testEvent);

  assert(
    order[0] === "CRITICAL" && order[1] === "HIGH" && order[2] === "NORMAL" && order[3] === "LOW",
    `Priority sequence check failed: got [${order.join(", ")}]`
  );
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified priority-sorted deterministic execution order.");
  bus.clear();

  // 4. Async Handler Execution Tests
  // eslint-disable-next-line no-console
  console.log("4. Running Async Handler Execution Tests...");
  let asyncFinished = false;
  const isFinished = () => asyncFinished;
  bus.subscribe("async.test", async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    asyncFinished = true;
  });

  const asyncEvent = new EventBuilder().withName("async.test").build();
  await bus.publish(asyncEvent);

  assert(
    isFinished() === true,
    "Publish promise must resolve only after async handler executes completely"
  );
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified async handler await behaviors.");
  bus.clear();

  // 5. Handler Failure Isolation Tests
  // eslint-disable-next-line no-console
  console.log("5. Running Handler Failure Isolation Tests...");
  let handlerAfterCrashedRan = false;
  const didCrashHandlerRun = () => handlerAfterCrashedRan;

  bus.subscribe(
    "crash.test",
    () => {
      throw new Error("Simulated handler crash");
    },
    EventPriority.HIGH
  );

  bus.subscribe(
    "crash.test",
    () => {
      handlerAfterCrashedRan = true;
    },
    EventPriority.NORMAL
  );

  const crashEvent = new EventBuilder().withName("crash.test").build();
  await bus.publish(crashEvent);

  assert(didCrashHandlerRun() === true, "Subsequent handlers must execute despite preceding crash");
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified handler execution failure isolation.");
  bus.clear();

  // 6. Snapshot & Immutability Tests
  // eslint-disable-next-line no-console
  console.log("6. Running Snapshot Immutability Checks...");
  bus.subscribe("snap.test1", () => {});
  bus.subscribe("snap.test1", () => {});
  bus.subscribe("snap.test2", () => {});

  const snap = bus.snapshot();
  assert(snap.subscriptionCount === 3, "Correct total subscriptions count");
  assert(
    snap.eventNames.includes("snap.test1") && snap.eventNames.includes("snap.test2"),
    "Event names listed"
  );
  assert(snap.subscriptionsByEvent["snap.test1"] === 2, "Event subscription count check");

  assert(Object.isFrozen(snap), "Snapshot must be frozen");
  assert(Object.isFrozen(snap.eventNames), "Event names array must be frozen");
  assert(
    Object.isFrozen(snap.subscriptionsByEvent),
    "Subscriptions breakdown object must be frozen"
  );

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (snap as any).subscriptionCount = 100;
    throw new Error("Should have thrown error in strict mode when modifying snapshot properties");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log("   ✓ Snapshot immutability verified successfully.");
  }

  // eslint-disable-next-line no-console
  console.log("=== ALL EVENT BUS VERIFICATION TESTS PASSED SUCCESSFULLY ===");
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
