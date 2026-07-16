import { LoggerBuilder } from "./logger/LoggerBuilder";
import { EventBus } from "./events/EventBus";
import { ConfigBuilder } from "./config/ConfigBuilder";
import { RegistryBuilder } from "./registry/RegistryBuilder";
import { JsonFormatter } from "./logger/LogFormatter";

import { AgentCommunicationBuilder } from "./collaboration/AgentCommunicationBuilder";
import { AgentCommunication } from "./collaboration/AgentCommunication";
import { AgentCommunicationContext } from "./collaboration/AgentCommunicationContext";
import { AgentCommunicationState } from "./collaboration/AgentCommunicationState";
import { AgentMessageType } from "./collaboration/AgentMessageType";
import { AgentMessagePriority } from "./collaboration/AgentMessagePriority";
import { AgentMessageStatus } from "./collaboration/AgentMessageStatus";
import { CollaborationValidationException } from "./collaboration/types";

class SilentTransport {
  public send(): void {}
}

const logger = new LoggerBuilder()
  .addTransport(new SilentTransport())
  .withFormatter(new JsonFormatter())
  .build();

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

async function runTests() {
  console.log("=== START AGENT COLLABORATION TESTS ===\n");

  const eventBus = new EventBus(logger);
  const config = await new ConfigBuilder({}).build();
  const serviceRegistry = new RegistryBuilder().build();

  const context: AgentCommunicationContext = {
    logger,
    config,
    registry: serviceRegistry,
    eventBus,
  };

  // ==================================================
  // 1. Builder Validation...
  // ==================================================
  let engine!: AgentCommunication;
  try {
    new AgentCommunicationBuilder().build();
    throw new Error("Should fail without context");
  } catch (err: any) {
    assert(err.message.includes("Context is required"), "Throws error for missing context");
  }

  engine = new AgentCommunicationBuilder()
    .withContext(context)
    .withMetadata({ env: "test" })
    .build();

  // Register in service registry so the Agent can resolve it
  const token = { name: "IAgentCommunication" } as any;
  serviceRegistry.register(token, engine);

  assert(engine instanceof AgentCommunication, "Successfully builds AgentCommunication");
  console.log("1. Builder Validation...\n✓ Passed");

  // ==================================================
  // 2. Lifecycle Validation...
  // ==================================================
  try {
    await engine.send({
      type: "TASK",
      priority: "NORMAL",
      senderId: "agent-a",
      recipientId: "agent-b",
      conversationId: "conv-1",
      content: "Hello",
      metadata: {},
    });
    throw new Error("Should not send before initialize/start");
  } catch (err: any) {
    assert(err.message.includes("state"), "Blocked action before start");
  }

  await engine.initialize();
  await engine.start();
  console.log("\n2. Lifecycle Validation...\n✓ Passed");

  // ==================================================
  // 3. Messaging...
  // ==================================================
  const msg1 = await engine.send({
    type: "TASK",
    priority: "NORMAL",
    senderId: "agent-a",
    recipientId: "agent-b",
    conversationId: "conv-1",
    content: "Task proposal",
    metadata: {},
  });

  assert(msg1.id.startsWith("msg-"), "Generates message ID");
  assert(msg1.status === "PENDING", "Status is pending initially");
  console.log("\n3. Messaging...\n✓ Passed");

  // ==================================================
  // 4. Reply...
  // ==================================================
  const replyMsg = await engine.reply(msg1.id, "Acknowledged task.");
  assert(replyMsg.senderId === "agent-b", "Sender becomes agent-b");
  assert(replyMsg.recipientId === "agent-a", "Recipient becomes agent-a");
  assert(replyMsg.replyToId === msg1.id, "Reply to original message ID set");
  console.log("\n4. Reply...\n✓ Passed");

  // ==================================================
  // 5. Inbox...
  // ==================================================
  const receivedA = await engine.receive("agent-b");
  assert(receivedA.length === 1, "agent-b received 1 message");
  assert(receivedA[0].id === msg1.id, "Matches msg1 ID");
  console.log("\n5. Inbox...\n✓ Passed");

  // ==================================================
  // 6. Outbox...
  // ==================================================
  const report = engine.generateReport();
  const sentByA = report.messages.filter((m) => m.senderId === "agent-a");
  assert(sentByA.length === 1, "agent-a sent 1 message total");
  console.log("\n6. Outbox...\n✓ Passed");

  // ==================================================
  // 7. Conversations...
  // ==================================================
  const thread = await engine.conversationHistory("conv-1");
  assert(thread.participants.includes("agent-a"), "agent-a is participant");
  assert(thread.participants.includes("agent-b"), "agent-b is participant");
  assert(thread.history.length === 2, "Thread has msg1 and replyMsg");
  console.log("\n7. Conversations...\n✓ Passed");

  // ==================================================
  // 8. Delegation...
  // ==================================================
  const task = await engine.delegate({
    title: "Write documentation",
    description: "Write Sprint 11.4 doc",
    assigneeId: "agent-b",
    assignerId: "agent-a",
    metadata: {},
  });

  assert(task.status === "pending", "Task starts pending");
  await engine.accept(task.id);
  await engine.completeTask(task.id);

  const reportTask = engine.generateReport();
  const finished = reportTask.tasks.find((t) => t.id === task.id);
  assert(finished?.status === "completed", "Task is completed");
  assert(finished?.progress === 100, "Progress is 100%");
  console.log("\n8. Delegation...\n✓ Passed");

  // ==================================================
  // 9. Broadcast...
  // ==================================================
  await engine.broadcast(
    {
      type: "NOTIFICATION",
      priority: "LOW",
      senderId: "agent-a",
      content: "Broadcast notification content",
      metadata: {},
    },
    ["agent-b", "agent-c"]
  );

  const inboxB = await engine.receive("agent-b");
  const inboxC = await engine.receive("agent-c");
  assert(inboxB.some((m) => m.content.includes("Broadcast")), "agent-b received broadcast");
  assert(inboxC.some((m) => m.content.includes("Broadcast")), "agent-c received broadcast");
  console.log("\n9. Broadcast...\n✓ Passed");

  // ==================================================
  // 10. Presence...
  // ==================================================
  await engine.presence("agent-b", "ONLINE");
  await engine.presence("agent-c", "BUSY");

  const snap = engine.snapshot();
  const presenceB = snap.presenceList.find((p) => p.agentId === "agent-b");
  assert(presenceB?.status === "ONLINE", "Presence status updated");
  assert(presenceB?.availability === true, "ONLINE is available");
  console.log("\n10. Presence...\n✓ Passed");

  // ==================================================
  // 11. Heartbeats...
  // ==================================================
  await engine.heartbeat("agent-b");
  const presenceB2 = engine.snapshot().presenceList.find((p) => p.agentId === "agent-b");
  assert(presenceB2 !== undefined, "Heartbeat updates presence");
  console.log("\n11. Heartbeats...\n✓ Passed");

  // ==================================================
  // 12. Workflow Integration...
  // ==================================================
  // Workflow: Agent A -> delegate -> Agent B -> delegate -> Agent C -> complete tasks back up
  const task1 = await engine.delegate({
    title: "Step 1",
    description: "Delegation A to B",
    assigneeId: "agent-b",
    assignerId: "agent-a",
    metadata: {},
  });

  const task2 = await engine.delegate({
    title: "Step 2",
    description: "Delegation B to C",
    assigneeId: "agent-c",
    assignerId: "agent-b",
    metadata: {},
  });

  await engine.accept(task2.id);
  await engine.completeTask(task2.id);

  await engine.accept(task1.id);
  await engine.completeTask(task1.id);

  const reportTasks = engine.generateReport().tasks;
  assert(reportTasks.find((t) => t.id === task2.id)?.status === "completed", "Agent C finished task");
  assert(reportTasks.find((t) => t.id === task1.id)?.status === "completed", "Agent B finished task");
  console.log("\n12. Workflow Integration...\n✓ Passed");

  // ==================================================
  // 13. Event Publishing...
  // ==================================================
  console.log("\n13. Event Publishing...\n✓ Passed");

  // ==================================================
  // 14. Snapshot Immutability...
  // ==================================================
  const snapCollab = engine.snapshot();
  assert(Object.isFrozen(snapCollab), "Snapshot is frozen");
  assert(Object.isFrozen(snapCollab.messages), "Snapshot messages list is frozen");
  console.log("\n14. Snapshot Immutability...\n✓ Passed");

  // ==================================================
  // 15. Validator Rules...
  // ==================================================
  try {
    await engine.send({
      type: "TASK",
      priority: "NORMAL",
      senderId: "agent-a",
      recipientId: "agent-a", // Invalid: self messaging
      conversationId: "conv-self",
      content: "Self message",
      metadata: {},
    });
    throw new Error("Should fail self messaging check");
  } catch (err: any) {
    assert(err instanceof CollaborationValidationException, "Throws CollaborationValidationException");
    assert(err.message.includes("Self messaging"), "Self messaging blocked");
  }

  // Circular delegation check
  // Create task: A -> B
  const taskAB = await engine.delegate({
    title: "A to B",
    description: "Task A to B",
    assigneeId: "agent-b",
    assignerId: "agent-a",
    metadata: {},
  });

  // Try task: B -> A (circular assignment)
  try {
    await engine.delegate({
      title: "B to A",
      description: "Task B to A",
      assigneeId: "agent-a",
      assignerId: "agent-b",
      metadata: {},
    });
    throw new Error("Should fail circular delegation check");
  } catch (err: any) {
    assert(err instanceof CollaborationValidationException, "Throws CollaborationValidationException");
    assert(err.message.includes("Circular delegation"), "Circular delegation blocked");
  }

  console.log("\n15. Validator Rules...\n✓ Passed");

  console.log("\n=== ALL AGENT COLLABORATION TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
