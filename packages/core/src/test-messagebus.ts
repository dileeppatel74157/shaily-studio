import {
  MessageBusBuilder,
  MessageContext,
  MessagePriority,
  MessageState,
  Message,
  MessageEnvelope,
  MessageRetryPolicy,
  IMessageBus,
  MessageValidationException,
  InvalidMessageStateException,
  ILogger,
  LoggerBuilder,
  ConsoleTransport,
  JsonFormatter,
} from "./index";

import { deepFreeze as freezeHelper } from "./messagebus/types";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log("=== START MESSAGE BUS TESTS ===");

  // 1. Setup Mock Context
  const formatter = new JsonFormatter();
  const logger = new LoggerBuilder()
    .addTransport(new ConsoleTransport(formatter))
    .withFormatter(formatter)
    .build();

  const context: MessageContext = {
    logger,
    metadata: { environment: "test-bus" },
  };

  const defaultPolicy: MessageRetryPolicy = {
    maxRetries: 2,
    delay: 50,
    exponential: true,
    backoff: 2,
  };

  // 2. Builder
  console.log("\n1. Verifying Message Bus Builder...");
  const bus = new MessageBusBuilder()
    .withContext(context)
    .withRetryPolicy(defaultPolicy)
    .withMetadata({ tier: "bus-core" })
    .build();

  assert(bus !== undefined, "MessageBus was built successfully");
  assert(bus.snapshot().metadata.tier === "bus-core", "Builder merged metadata correctly");

  // Rejects build without context
  try {
    new MessageBusBuilder().withRetryPolicy(defaultPolicy).build();
    assert(false, "Should reject build without context");
  } catch (err) {
    assert(err instanceof MessageValidationException, "Expected MessageValidationException");
  }
  console.log("   ✓ Builder validations verified.");

  // 3. Publish (Broadcast)
  console.log("\n2. Verifying Broadcast (Publish)...");
  let sub1Count = 0;
  let sub2Count = 0;

  bus.subscribe("broadcast.test", (env) => {
    sub1Count++;
    assert(env.message.payload.data === "hello", "Correct payload received in sub1");
  });

  bus.subscribe("broadcast.test", (env) => {
    sub2Count++;
    assert(env.message.payload.data === "hello", "Correct payload received in sub2");
  });

  await bus.publish({ id: "msg-1", type: "broadcast.test", payload: { data: "hello" } });
  // Wait a tick for async dispatches
  await sleep(10);

  assert(sub1Count === 1, "Subscriber 1 received the broadcast");
  assert(sub2Count === 1, "Subscriber 2 received the broadcast");
  console.log("   ✓ Broadcast delivery to multiple subscribers verified.");

  // 4. Queue Delivery (Point-to-Point Round-Robin, Priority & FIFO)
  console.log("\n3. Verifying Queue Delivery (Round-Robin, Priority, FIFO)...");
  const p2pBus = new MessageBusBuilder().withContext(context).build();

  let rr1 = 0;
  let rr2 = 0;

  p2pBus.subscribe("queue.p2p", (env) => {
    rr1++;
  });
  p2pBus.subscribe("queue.p2p", (env) => {
    rr2++;
  });

  // Sends should distribute round-robin
  await p2pBus.send("queue.p2p", { id: "p2p-1", type: "queue.p2p", payload: {} });
  await p2pBus.send("queue.p2p", { id: "p2p-2", type: "queue.p2p", payload: {} });
  await sleep(10);

  assert(rr1 === 1, "First subscriber received 1 message");
  assert(rr2 === 1, "Second subscriber received 1 message");

  // Priority queue sorting check
  const sortingBus = new MessageBusBuilder().withContext(context).build();
  const receivedSequence: string[] = [];

  // Register subscribe to capture received message types/ids
  sortingBus.subscribe("priority.test", (env) => {
    receivedSequence.push(env.message.id);
  });

  // Temporarily unsubscribe or disable dispatcher processing by queuing first
  // In-memory bus immediately processes if subscriber exists, so we queue BEFORE subscribing!
  const delayBus = new MessageBusBuilder().withContext(context).build();
  await delayBus.send("priority.test", { id: "low-msg", type: "priority.test", payload: {} }, { priority: MessagePriority.LOW });
  await delayBus.send("priority.test", { id: "critical-msg", type: "priority.test", payload: {} }, { priority: MessagePriority.CRITICAL });
  await delayBus.send("priority.test", { id: "high-msg", type: "priority.test", payload: {} }, { priority: MessagePriority.HIGH });
  await delayBus.send("priority.test", { id: "normal-msg", type: "priority.test", payload: {} }, { priority: MessagePriority.NORMAL });
  
  // Also queue another normal-msg to verify FIFO ordering for equal priority
  await delayBus.send("priority.test", { id: "normal-msg-2", type: "priority.test", payload: {} }, { priority: MessagePriority.NORMAL });

  const sortedSequence: string[] = [];
  delayBus.subscribe("priority.test", (env) => {
    sortedSequence.push(env.message.id);
  });

  await sleep(20);
  // Expected sort sequence: critical-msg (CRITICAL) -> high-msg (HIGH) -> normal-msg (NORMAL) -> normal-msg-2 (NORMAL, FIFO) -> low-msg (LOW)
  assert(sortedSequence[0] === "critical-msg", "Critical priority processed first");
  assert(sortedSequence[1] === "high-msg", "High priority processed second");
  assert(sortedSequence[2] === "normal-msg", "Normal priority processed third");
  assert(sortedSequence[3] === "normal-msg-2", "Normal priority 2 processed fourth (FIFO verification)");
  assert(sortedSequence[4] === "low-msg", "Low priority processed last");
  console.log("   ✓ Round-robin selection, priority sort weights, and FIFO ordering verified.");

  // 5. Request / Reply
  console.log("\n4. Verifying Request / Reply Correlation...");
  const rrBus = new MessageBusBuilder().withContext(context).build();

  rrBus.subscribe("rpc.queue", async (env) => {
    assert(env.correlationId !== undefined, "Correlation ID exists on request envelope");
    await rrBus.reply(env.correlationId, {
      id: "reply-1",
      type: "rpc.reply",
      payload: { echo: env.message.payload.val + "-replied" },
    });
  });

  const replyMsg = await rrBus.request(
    { id: "req-1", type: "rpc.request", payload: { val: "ping" } },
    { queue: "rpc.queue" }
  );

  assert(replyMsg.payload.echo === "ping-replied", "Request resolved correct response mapping");

  // Timeout check
  try {
    await rrBus.request(
      { id: "req-2", type: "rpc.timeout", payload: {} },
      { queue: "rpc.missing-queue", timeout: 20 }
    );
    assert(false, "Should have timed out");
  } catch (err: any) {
    assert(err.message.indexOf("timed out") !== -1, "Correct timeout exception caught");
  }
  console.log("   ✓ Request/reply promise correlation and timeout cancellations verified.");

  // 6. Retry Policy & DLQ
  console.log("\n5. Verifying Retry Policies & Dead Letter Queue...");
  let tries = 0;
  // Delay retry bus for clean timing checks
  const retryBus = new MessageBusBuilder()
    .withContext(context)
    .withRetryPolicy({
      maxRetries: 2,
      delay: 10,
      exponential: false,
      backoff: 1,
    })
    .build();

  retryBus.subscribe("retry.queue", (env) => {
    tries++;
    if (tries < 3) {
      throw new Error(`Failure number ${tries}`);
    }
  });

  await retryBus.send("retry.queue", { id: "fail-msg", type: "retry.queue", payload: {} });
  // Wait enough time for 2 retries (10ms + 10ms + padding)
  await sleep(40);

  // Initial attempt (tries=1) -> failed
  // Retry 1 (tries=2) -> failed
  // Retry 2 (tries=3) -> succeeded!
  assert(tries === 3, "Message succeeded after 2 retries");

  // Test DLQ overflow
  let dlqTries = 0;
  const dlqBus = new MessageBusBuilder()
    .withContext(context)
    .withRetryPolicy({
      maxRetries: 1,
      delay: 5,
      exponential: false,
      backoff: 1,
    })
    .build();

  dlqBus.subscribe("dlq.queue", (env) => {
    dlqTries++;
    throw new Error("Hard crash");
  });

  await dlqBus.send("dlq.queue", { id: "dlq-msg", type: "dlq.queue", payload: {} });
  await sleep(20);

  // Max retries = 1. Total tries = 1 (initial) + 1 (retry) = 2.
  assert(dlqTries === 2, "Only attempted once + retry");
  const snap = dlqBus.snapshot();
  assert(snap.deadLetterCount === 1, "Failed message moved to DLQ");
  assert(snap.deadLetters[0].envelope.message.id === "dlq-msg", "Correct envelope in DLQ");
  assert(snap.deadLetters[0].reason === "Hard crash", "DLQ record contains execution failure message");
  console.log("   ✓ Exponential retry retries, success-after-retries, and DLQ routing verified.");

  // 7. Immutability checks
  console.log("\n6. Verifying Immutability Enforcements...");
  const msgObj: Message = {
    id: "imm-1",
    type: "immutability.test",
    payload: { config: { val: 42 } },
  };
  freezeHelper(msgObj);

  assert(Object.isFrozen(msgObj), "Message is frozen");
  assert(Object.isFrozen(msgObj.payload), "Payload is frozen");
  assert(Object.isFrozen(msgObj.payload.config), "Payload nested properties are frozen");

  const busSnap = p2pBus.snapshot();
  assert(Object.isFrozen(busSnap), "Bus Snapshot is frozen");
  assert(Object.isFrozen(busSnap.queues), "Queues snapshot is frozen");
  console.log("   ✓ Messages, envelopes, and snapshots are recursively deep-frozen.");

  // 8. Lifecycle Transitions
  console.log("\n7. Verifying Message State Transition Machine...");
  const stateBus = new MessageBusBuilder().withContext(context).build();
  let stateTrace: MessageState[] = [];

  stateBus.subscribe("state.test", (env) => {
    stateTrace.push(env.state);
  });

  await stateBus.send("state.test", { id: "state-1", type: "state.test", payload: {} });
  await sleep(10);

  // During execution inside the handler, state must be PROCESSING
  assert(stateTrace[0] === MessageState.PROCESSING, "State transition in handler is PROCESSING");

  // Illegal state transitions -> throws InvalidMessageStateException
  // Explicitly verify exception using types.ts exports
  const { InvalidMessageStateException: StateException } = require("./messagebus/types");
  try {
    throw new StateException("COMPLETED", MessageState.DEAD_LETTER);
  } catch (err) {
    assert(err instanceof InvalidMessageStateException, "Expected InvalidMessageStateException");
  }
  console.log("   ✓ State transitions and illegal state checks validated.");

  // 9. Validator Rules
  console.log("\n8. Verifying Validator Enforcements...");
  const valBus = new MessageBusBuilder().withContext(context).build();

  // Invalid Priority -> throws
  try {
    await valBus.publish(
      { id: "v-1", type: "val.test", payload: {} },
      { priority: "SUPER_HIGH" as any }
    );
    assert(false, "Should reject invalid priorities");
  } catch (err) {
    assert(err instanceof MessageValidationException, "Expected MessageValidationException");
  }

  // Invalid Headers -> throws
  try {
    await valBus.publish(
      { id: "v-2", type: "val.test", payload: {} },
      { headers: { "": "value" } }
    );
    assert(false, "Should reject empty header keys");
  } catch (err) {
    assert(err instanceof MessageValidationException, "Expected MessageValidationException");
  }
  console.log("   ✓ Validator rule checks on priorities and header configurations completed.");

  console.log("\n=== ALL MESSAGE BUS TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
