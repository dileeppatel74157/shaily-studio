import { IAgentCommunication } from "./IAgentCommunication";
import { AgentCommunicationContext } from "./AgentCommunicationContext";
import { AgentCommunicationState } from "./AgentCommunicationState";
import { AgentMessage } from "./AgentMessage";
import { AgentPresence, AgentPresenceStatus } from "./AgentPresence";
import { AgentTaskAssignment } from "./AgentTaskAssignment";
import { AgentConversationThread } from "./AgentConversationThread";
import { AgentCollaborationReport } from "./AgentCollaborationReport";
import { AgentCommunicationSnapshot } from "./AgentCommunicationSnapshot";
import { AgentConversation } from "./AgentConversation";
import { AgentCommunicationValidator } from "./AgentCommunicationValidator";
import { deepFreeze, CollaborationValidationException, InvalidCollaborationStateException } from "./types";

export class AgentCommunication implements IAgentCommunication {
  private _state = AgentCommunicationState.CREATED;
  private readonly _messages = new Map<string, AgentMessage>();
  private readonly _conversations = new Map<string, AgentConversation>();
  private readonly _tasks = new Map<string, AgentTaskAssignment>();
  private readonly _presence = new Map<string, AgentPresence>();
  private readonly _inboxes = new Map<string, AgentMessage[]>();
  private readonly _outboxes = new Map<string, AgentMessage[]>();
  private readonly _validator = new AgentCommunicationValidator();

  constructor(
    public readonly context: AgentCommunicationContext,
    public readonly metadata: Record<string, unknown> = {}
  ) {}

  public async initialize(): Promise<void> {
    if (this._state !== AgentCommunicationState.CREATED) {
      throw new InvalidCollaborationStateException("initialize", this._state);
    }
    this._state = AgentCommunicationState.READY;
    this.context.logger.info("AgentCommunication initialized");
  }

  public async start(): Promise<void> {
    if (this._state !== AgentCommunicationState.READY) {
      throw new InvalidCollaborationStateException("start", this._state);
    }
    this._state = AgentCommunicationState.RUNNING;
    this.context.logger.info("AgentCommunication started");
  }

  public async stop(): Promise<void> {
    if (this._state !== AgentCommunicationState.RUNNING) {
      throw new InvalidCollaborationStateException("stop", this._state);
    }
    this._state = AgentCommunicationState.STOPPED;
    this.context.logger.info("AgentCommunication stopped");
  }

  public async send(
    messageData: Omit<AgentMessage, "id" | "status" | "timestamp">
  ): Promise<AgentMessage> {
    if (this._state !== AgentCommunicationState.RUNNING) {
      throw new InvalidCollaborationStateException("send", this._state);
    }

    this._validator.validateMessage(messageData as any);

    const id = "msg-" + Math.random().toString(36).substring(2, 11);
    const message: AgentMessage = deepFreeze({
      ...messageData,
      id,
      status: "PENDING",
      timestamp: new Date(),
    });

    this._messages.set(id, message);

    // Save to sender's outbox
    const senderOutbox = this._outboxes.get(message.senderId) || [];
    senderOutbox.push(message);
    this._outboxes.set(message.senderId, senderOutbox);

    // Save to recipient's inbox
    const recipientInbox = this._inboxes.get(message.recipientId) || [];
    recipientInbox.push(message);
    this._inboxes.set(message.recipientId, recipientInbox);

    // Save conversation
    if (!this._conversations.has(message.conversationId)) {
      this._conversations.set(message.conversationId, {
        id: message.conversationId,
        participants: [message.senderId, message.recipientId],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "AgentMessageSent",
        timestamp: new Date(),
        correlationId: "corr-collab",
        source: "AgentCommunication",
        payload: { messageId: id, senderId: message.senderId, recipientId: message.recipientId },
        metadata: {},
      });
    }

    return message;
  }

  public async reply(replyToMessageId: string, replyContent: string): Promise<AgentMessage> {
    if (this._state !== AgentCommunicationState.RUNNING) {
      throw new InvalidCollaborationStateException("reply", this._state);
    }

    const parent = this._messages.get(replyToMessageId);
    if (!parent) {
      throw new CollaborationValidationException(`Parent message with ID ${replyToMessageId} not found.`);
    }

    const replyMsg = await this.send({
      type: "ANSWER",
      priority: parent.priority,
      senderId: parent.recipientId, // Reply sender is the original recipient
      recipientId: parent.senderId, // Reply recipient is the original sender
      conversationId: parent.conversationId,
      threadId: parent.threadId || parent.id,
      replyToId: parent.id,
      content: replyContent,
      metadata: {},
    });

    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "AgentReplySent",
        timestamp: new Date(),
        correlationId: "corr-collab",
        source: "AgentCommunication",
        payload: { replyMessageId: replyMsg.id, parentMessageId: replyToMessageId },
        metadata: {},
      });
    }

    return replyMsg;
  }

  public async receive(agentId: string): Promise<ReadonlyArray<AgentMessage>> {
    if (this._state !== AgentCommunicationState.RUNNING) {
      throw new InvalidCollaborationStateException("receive", this._state);
    }

    const inbox = this._inboxes.get(agentId) || [];
    const unread = inbox.filter((m) => m.status === "PENDING" || m.status === "DELIVERED");

    // Update statuses to DELIVERED/READ
    for (const msg of unread) {
      const updated: AgentMessage = {
        ...msg,
        status: "DELIVERED",
      };
      this._messages.set(msg.id, updated);
      
      // Update in inbox
      const idx = inbox.findIndex((m) => m.id === msg.id);
      if (idx !== -1) {
        inbox[idx] = updated;
      }

      if (this.context.eventBus) {
        await this.context.eventBus.publish({
          id: "evt-" + Math.random().toString(36).substring(2, 11),
          name: "AgentMessageReceived",
          timestamp: new Date(),
          correlationId: "corr-collab",
          source: "AgentCommunication",
          payload: { messageId: msg.id, recipientId: agentId },
          metadata: {},
        });
      }
    }

    return deepFreeze([...unread]);
  }

  public async acknowledge(messageId: string): Promise<void> {
    const msg = this._messages.get(messageId);
    if (msg) {
      const updated: AgentMessage = { ...msg, status: "READ" };
      this._messages.set(messageId, updated);
    }
  }

  public async reject(messageId: string): Promise<void> {
    const msg = this._messages.get(messageId);
    if (msg) {
      const updated: AgentMessage = { ...msg, status: "FAILED" };
      this._messages.set(messageId, updated);
    }
  }

  public async complete(messageId: string): Promise<void> {
    const msg = this._messages.get(messageId);
    if (msg) {
      const updated: AgentMessage = { ...msg, status: "COMPLETED" };
      this._messages.set(messageId, updated);
    }
  }

  public async delegate(
    assignment: Omit<AgentTaskAssignment, "id" | "status" | "progress" | "createdAt" | "updatedAt">
  ): Promise<AgentTaskAssignment> {
    if (this._state !== AgentCommunicationState.RUNNING) {
      throw new InvalidCollaborationStateException("delegate", this._state);
    }

    this._validator.validateCircularDelegation(assignment.assigneeId, assignment.assignerId, this._tasks);

    const id = "task-assign-" + Math.random().toString(36).substring(2, 11);
    const task: AgentTaskAssignment = deepFreeze({
      ...assignment,
      id,
      status: "pending",
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this._tasks.set(id, task);

    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "TaskDelegated",
        timestamp: new Date(),
        correlationId: "corr-collab",
        source: "AgentCommunication",
        payload: { taskId: id, delegatorId: assignment.assignerId, delegateeId: assignment.assigneeId },
        metadata: {},
      });
    }

    return task;
  }

  public async accept(taskId: string): Promise<void> {
    const task = this._tasks.get(taskId);
    if (!task) {
      throw new CollaborationValidationException(`Task with ID ${taskId} not found.`);
    }
    this._validator.validateTaskTransition(task.status, "accepted");

    const updated: AgentTaskAssignment = deepFreeze({
      ...task,
      status: "accepted",
      updatedAt: new Date(),
    });
    this._tasks.set(taskId, updated);

    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "TaskAccepted",
        timestamp: new Date(),
        correlationId: "corr-collab",
        source: "AgentCommunication",
        payload: { taskId },
        metadata: {},
      });
    }
  }

  public async rejectTask(taskId: string): Promise<void> {
    const task = this._tasks.get(taskId);
    if (!task) {
      throw new CollaborationValidationException(`Task with ID ${taskId} not found.`);
    }
    this._validator.validateTaskTransition(task.status, "rejected");

    const updated: AgentTaskAssignment = deepFreeze({
      ...task,
      status: "rejected",
      updatedAt: new Date(),
    });
    this._tasks.set(taskId, updated);

    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "TaskRejected",
        timestamp: new Date(),
        correlationId: "corr-collab",
        source: "AgentCommunication",
        payload: { taskId },
        metadata: {},
      });
    }
  }

  public async completeTask(taskId: string): Promise<void> {
    const task = this._tasks.get(taskId);
    if (!task) {
      throw new CollaborationValidationException(`Task with ID ${taskId} not found.`);
    }
    this._validator.validateTaskTransition(task.status, "completed");

    const updated: AgentTaskAssignment = deepFreeze({
      ...task,
      status: "completed",
      progress: 100,
      updatedAt: new Date(),
    });
    this._tasks.set(taskId, updated);

    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "TaskCompleted",
        timestamp: new Date(),
        correlationId: "corr-collab",
        source: "AgentCommunication",
        payload: { taskId },
        metadata: {},
      });
    }
  }

  public async cancelTask(taskId: string): Promise<void> {
    const task = this._tasks.get(taskId);
    if (!task) {
      throw new CollaborationValidationException(`Task with ID ${taskId} not found.`);
    }
    this._validator.validateTaskTransition(task.status, "cancelled");

    const updated: AgentTaskAssignment = deepFreeze({
      ...task,
      status: "cancelled",
      updatedAt: new Date(),
    });
    this._tasks.set(taskId, updated);
  }

  public async progressTask(taskId: string, progress: number): Promise<void> {
    const task = this._tasks.get(taskId);
    if (!task) {
      throw new CollaborationValidationException(`Task with ID ${taskId} not found.`);
    }
    const updated: AgentTaskAssignment = deepFreeze({
      ...task,
      progress,
      updatedAt: new Date(),
    });
    this._tasks.set(taskId, updated);
  }

  public async broadcast(
    messageData: Omit<AgentMessage, "id" | "status" | "timestamp" | "recipientId" | "conversationId">,
    recipientIds: ReadonlyArray<string>
  ): Promise<void> {
    if (this._state !== AgentCommunicationState.RUNNING) {
      throw new InvalidCollaborationStateException("broadcast", this._state);
    }

    const conversationId = "broadcast-" + Math.random().toString(36).substring(2, 11);
    for (const rId of recipientIds) {
      await this.send({
        ...messageData,
        recipientId: rId,
        conversationId,
      });
    }

    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "BroadcastSent",
        timestamp: new Date(),
        correlationId: "corr-collab",
        source: "AgentCommunication",
        payload: { senderId: messageData.senderId, recipientIds },
        metadata: {},
      });
    }
  }

  public async multicast(
    messageData: Omit<AgentMessage, "id" | "status" | "timestamp" | "recipientId" | "conversationId">,
    recipientIds: ReadonlyArray<string>
  ): Promise<void> {
    await this.broadcast(messageData, recipientIds);
  }

  public async unicast(messageData: Omit<AgentMessage, "id" | "status" | "timestamp">): Promise<void> {
    await this.send(messageData);
  }

  public async presence(agentId: string, status: AgentPresenceStatus): Promise<void> {
    if (this._state !== AgentCommunicationState.RUNNING) {
      throw new InvalidCollaborationStateException("presence", this._state);
    }

    const presenceRecord: AgentPresence = deepFreeze({
      agentId,
      status,
      lastSeen: new Date(),
      availability: status === "ONLINE" || status === "IDLE",
    });

    this._presence.set(agentId, presenceRecord);

    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: status === "ONLINE" ? "AgentOnline" : "AgentOffline",
        timestamp: new Date(),
        correlationId: "corr-collab",
        source: "AgentCommunication",
        payload: { agentId },
        metadata: {},
      });
    }
  }

  public async heartbeat(agentId: string): Promise<void> {
    if (this._state !== AgentCommunicationState.RUNNING) {
      throw new InvalidCollaborationStateException("heartbeat", this._state);
    }

    this._validator.validateHeartbeat(agentId, new Date());

    const presenceRecord: AgentPresence = deepFreeze({
      agentId,
      status: "ONLINE",
      lastSeen: new Date(),
      availability: true,
    });

    this._presence.set(agentId, presenceRecord);

    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "HeartbeatReceived",
        timestamp: new Date(),
        correlationId: "corr-collab",
        source: "AgentCommunication",
        payload: { agentId },
        metadata: {},
      });
    }
  }

  public async conversationHistory(conversationId: string): Promise<AgentConversationThread> {
    if (this._state !== AgentCommunicationState.RUNNING) {
      throw new InvalidCollaborationStateException("conversationHistory", this._state);
    }

    const history = Array.from(this._messages.values())
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const participants = Array.from(new Set(history.map((h) => [h.senderId, h.recipientId]).flat()));

    return deepFreeze({
      id: "thread-" + conversationId,
      conversationId,
      participants,
      history,
      lastMessageTimestamp: history.length > 0 ? history[history.length - 1].timestamp : new Date(),
      metadata: {},
    });
  }

  public generateReport(): AgentCollaborationReport {
    const listTasks = Array.from(this._tasks.values());
    const listMessages = Array.from(this._messages.values());

    const completed = listTasks.filter((t) => t.status === "completed").length;
    const failed = listTasks.filter((t) => t.status === "failed").length;
    const online = Array.from(this._presence.values()).filter((p) => p.status === "ONLINE").length;

    return deepFreeze({
      timestamp: new Date(),
      messages: listMessages,
      tasks: listTasks,
      completedTasksCount: completed,
      failedTasksCount: failed,
      broadcastCount: listMessages.filter((m) => m.conversationId.startsWith("broadcast-")).length,
      delegationsCount: listTasks.length,
      onlineAgentsCount: online,
      statistics: {
        totalMessages: listMessages.length,
        totalTasks: listTasks.length,
      },
    });
  }

  public snapshot(): AgentCommunicationSnapshot {
    return deepFreeze({
      timestamp: new Date(),
      state: this._state,
      messages: Array.from(this._messages.values()),
      conversations: Array.from(this._conversations.values()),
      presenceList: Array.from(this._presence.values()),
    });
  }
}
