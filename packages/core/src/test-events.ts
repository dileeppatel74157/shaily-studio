import { EventBus } from "./events/EventBus";
import { EventBuilder } from "./events/EventBuilder";
import { EventPriority } from "./events/EventPriority";
import { EventState } from "./events/EventState";
import { EventValidator } from "./events/EventValidator";
import { EventException, EventValidationException } from "./events/types";

function assert(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

async function runTests() {
  console.log("=== START EVENT BUS FRAMEWORK TESTS ===\n");

  // ==========================================
  // 1. Verifying Event Builder & Validator
  // ==========================================
  console.log("1. Verifying Event Builder & Validator...");
  const builder = new EventBuilder()
    .withName("test.event")
    .withSource("test-suite")
    .withCorrelationId("corr-123")
    .withPayload({ test: "data" })
    .withMetadata({ custom: "meta" });

  const event = builder.build();
  assert(event.name === "test.event");
  assert(event.source === "test-suite");
  assert(event.correlationId === "corr-123");
  assert(event.payload.test === "data");
  assert(event.metadata.custom === "meta");
  assert(Object.isFrozen(event), "Event should be frozen");
  assert(Object.isFrozen(event.payload), "Payload should be frozen");
  assert(Object.isFrozen(event.metadata), "Metadata should be frozen");

  // Validate validator rules
  EventValidator.validateEvent(event);

  try {
    EventValidator.validateEvent(null as any);
    assert(false, "Should throw on null event");
  } catch (err: any) {
    assert(err.message.includes("null") || err.message.includes("undefined"));
  }

  try {
    EventValidator.validateEvent({ id: "", name: "test" } as any);
    assert(false, "Should throw on empty ID");
  } catch (err: any) {
    assert(err.message.includes("ID"));
  }
  console.log("   ✓ Event validation and builder verified.");

  // ==========================================
  // 2. Verifying Basic Publish, Subscribe, Unsubscribe
  // ==========================================
  console.log("\n2. Verifying Basic Publish, Subscribe, Unsubscribe...");
  const eventBus = new EventBus();
  assert(eventBus.state === EventState.RUNNING, "EventBus state should be RUNNING");

  let received: boolean = false;
  let receivedPayload: any = null;

  const sub = eventBus.subscribe("test.event", (evt) => {
    received = true;
    receivedPayload = evt.payload;
  });

  await eventBus.publish(event);
  assert(received, "Event should be received by subscriber");
  assert(receivedPayload.test === "data", "Payload should match");

  // Unsubscribe
  const unsubscribed = eventBus.unsubscribe(sub.id);
  assert(unsubscribed, "Unsubscribe should return true");
  
  received = false;
  await eventBus.publish(event);
  assert(!received, "Unsubscribed handler should not receive events");
  console.log("   ✓ Basic pub-sub lifecycle verified.");

  // ==========================================
  // 3. Verifying Wildcard Handlers
  // ==========================================
  console.log("\n3. Verifying Wildcard Handlers...");
  let wildcardCount = 0;
  let wildcardCount2 = 0;

  // Subscribing to "workflow.*"
  eventBus.subscribe("workflow.*", () => {
    wildcardCount++;
  });

  // Subscribing to "*"
  eventBus.subscribe("*", () => {
    wildcardCount2++;
  });

  const wfStarted = new EventBuilder().withName("workflow.started").withPayload({}).build();
  const wfCompleted = new EventBuilder().withName("workflow.completed").withPayload({}).build();
  const otherEvt = new EventBuilder().withName("other.started").withPayload({}).build();

  await eventBus.publish(wfStarted);
  await eventBus.publish(wfCompleted);
  await eventBus.publish(otherEvt);

  assert(wildcardCount === 2, "workflow.* should match workflow.started and workflow.completed");
  assert(wildcardCount2 === 3, "* should match all events");
  console.log("   ✓ Wildcard matching verified.");

  // ==========================================
  // 4. Verifying Asynchronous Handlers
  // ==========================================
  console.log("\n4. Verifying Asynchronous Handlers...");
  const trace: string[] = [];

  eventBus.subscribe("async.event", async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    trace.push("async-done");
  });

  const asyncEvt = new EventBuilder().withName("async.event").withPayload({}).build();
  await eventBus.publish(asyncEvt);
  assert(trace[0] === "async-done", "Publisher should await async handlers");
  console.log("   ✓ Asynchronous handler execution verified.");

  // ==========================================
  // 5. Verifying Priorities
  // ==========================================
  console.log("\n5. Verifying Priorities...");
  const priorityTrace: string[] = [];
  eventBus.clear();

  eventBus.subscribe("priority.event", () => { priorityTrace.push("normal"); }, EventPriority.NORMAL);
  eventBus.subscribe("priority.event", () => { priorityTrace.push("critical"); }, EventPriority.CRITICAL);
  eventBus.subscribe("priority.event", () => { priorityTrace.push("high"); }, EventPriority.HIGH);
  eventBus.subscribe("priority.event", () => { priorityTrace.push("low"); }, EventPriority.LOW);

  const priorityEvt = new EventBuilder().withName("priority.event").withPayload({}).build();
  await eventBus.publish(priorityEvt);

  assert(priorityTrace.length === 4, "Should execute all handlers");
  assert(priorityTrace[0] === "critical", "Critical first");
  assert(priorityTrace[1] === "high", "High second");
  assert(priorityTrace[2] === "normal", "Normal third");
  assert(priorityTrace[3] === "low", "Low fourth");
  console.log("   ✓ Priority-ordered execution verified.");

  // ==========================================
  // 6. Verifying Middleware
  // ==========================================
  console.log("\n6. Verifying Middleware...");
  const mwTrace: string[] = [];
  eventBus.clear();

  eventBus.use(async (evt, next) => {
    mwTrace.push("mw1-start");
    await next();
    mwTrace.push("mw1-end");
  });

  eventBus.use(async (evt, next) => {
    mwTrace.push("mw2-start");
    await next();
    mwTrace.push("mw2-end");
  });

  eventBus.subscribe("mw.event", () => {
    mwTrace.push("handler");
  });

  const mwEvt = new EventBuilder().withName("mw.event").withPayload({}).build();
  await eventBus.publish(mwEvt);

  assert(mwTrace.length === 5, "Trace count matches");
  assert(mwTrace[0] === "mw1-start");
  assert(mwTrace[1] === "mw2-start");
  assert(mwTrace[2] === "handler");
  assert(mwTrace[3] === "mw2-end");
  assert(mwTrace[4] === "mw1-end");
  console.log("   ✓ Koa-style middleware pipeline verified.");

  // ==========================================
  // 7. Verifying Middleware Cancellation
  // ==========================================
  console.log("\n7. Verifying Middleware Cancellation...");
  const cancelTrace: string[] = [];
  const cancelBus = new EventBus();

  cancelBus.use(async (evt, next) => {
    cancelTrace.push("mw-intercept");
    // Do not call next()
  });

  cancelBus.subscribe("cancel.event", () => {
    cancelTrace.push("handler");
  });

  const cancelEvt = new EventBuilder().withName("cancel.event").withPayload({}).build();
  await cancelBus.publish(cancelEvt);

  assert(cancelTrace.length === 1 && cancelTrace[0] === "mw-intercept", "Next handler execution should be skipped if next() is not called");
  console.log("   ✓ Middleware execution cancellation verified.");

  // ==========================================
  // 8. Verifying Event Filtering
  // ==========================================
  console.log("\n8. Verifying Event Filtering...");
  const filterTrace: string[] = [];
  eventBus.clear();

  eventBus.subscribe(
    "filter.event",
    () => { filterTrace.push("triggered"); },
    EventPriority.NORMAL,
    (evt) => evt.payload.value === "yes"
  );

  const rejectEvt = new EventBuilder().withName("filter.event").withPayload({ value: "no" }).build();
  const acceptEvt = new EventBuilder().withName("filter.event").withPayload({ value: "yes" }).build();

  await eventBus.publish(rejectEvt);
  await eventBus.publish(acceptEvt);

  assert(filterTrace.length === 1 && filterTrace[0] === "triggered", "Filtered subscription should only run when filter evaluates to true");
  console.log("   ✓ Event filtering verified.");

  // ==========================================
  // 9. Verifying Event History
  // ==========================================
  console.log("\n9. Verifying Event History...");
  const histBus = new EventBus();
  const evt1 = new EventBuilder().withName("evt1").withPayload({}).build();
  const evt2 = new EventBuilder().withName("evt2").withPayload({}).build();

  await histBus.publish(evt1);
  await histBus.publish(evt2);

  const history = histBus.history.all;
  assert(history.length === 2, "History should retain published events");
  assert(history[0].name === "evt1");
  assert(history[1].name === "evt2");
  console.log("   ✓ Event history tracking verified.");

  // ==========================================
  // 10. Verifying Once Subscriptions
  // ==========================================
  console.log("\n10. Verifying Once Subscriptions...");
  const onceBus = new EventBus();
  let onceCount = 0;

  onceBus.once("once.event", () => {
    onceCount++;
  });

  const onceEvt = new EventBuilder().withName("once.event").withPayload({}).build();
  await onceBus.publish(onceEvt);
  await onceBus.publish(onceEvt);

  assert(onceCount === 1, "Once subscriber should execute exactly once");
  console.log("   ✓ Once subscriptions verified.");

  // ==========================================
  // 11. Verifying Duplicate Subscriptions
  // ==========================================
  console.log("\n11. Verifying Duplicate Subscriptions...");
  const dupBus = new EventBus();
  let dupCount = 0;
  const duplicateHandler = () => { dupCount++; };

  dupBus.subscribe("dup.event", duplicateHandler);
  dupBus.subscribe("dup.event", duplicateHandler);

  const dupEvt = new EventBuilder().withName("dup.event").withPayload({}).build();
  await dupBus.publish(dupEvt);

  assert(dupCount === 2, "Duplicate subscriptions should both receive the event");
  console.log("   ✓ Duplicate subscription registrations verified.");

  // ==========================================
  // 12. Verifying Immutable Snapshots
  // ==========================================
  console.log("\n12. Verifying Immutable Snapshots...");
  const snapBus = new EventBus();
  snapBus.subscribe("snap.event1", () => {});
  snapBus.subscribe("snap.event1", () => {});
  snapBus.subscribe("snap.event2", () => {});

  const snap = snapBus.snapshot();
  assert(snap.state === EventState.RUNNING);
  assert(snap.subscriptionCount === 3);
  assert(snap.subscriptionsByEvent["snap.event1"] === 2);
  assert(snap.subscriptionsByEvent["snap.event2"] === 1);
  assert(Object.isFrozen(snap), "Snapshot should be frozen");
  console.log("   ✓ Immutable snapshot creation verified.");

  console.log("\n=== ALL EVENT BUS TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
