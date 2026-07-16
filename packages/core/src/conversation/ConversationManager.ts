import { IConversationManager } from "./IConversationManager";
import { Conversation } from "./Conversation";
import { ConversationMessage } from "./ConversationMessage";
import { ConversationHistory } from "./ConversationHistory";
import { ConversationSummary } from "./ConversationSummary";
import { ConversationSearch } from "./ConversationSearch";
import { ConversationSearchResult } from "./ConversationSearchResult";
import { ConversationSnapshot } from "./ConversationSnapshot";
import { ConversationMetadata } from "./ConversationMetadata";
import { ConversationSession } from "./ConversationSession";
import { ConversationContext } from "./ConversationContext";
import { ConversationState } from "./ConversationState";
import { ConversationValidator } from "./ConversationValidator";
import { MetricType } from "../observability/MetricType";
import {
  InvalidConversationStateException,
  ConversationValidationException,
  deepFreeze,
} from "./types";
import { IEventBus } from "../events/IEventBus";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export class ConversationManager implements IConversationManager {
  private _state: ConversationState = ConversationState.CREATED;
  private _initializedAt?: Date;
  private _startedAt?: Date;
  private _stoppedAt?: Date;
  private readonly _conversations = new Map<string, Conversation>();
  private readonly _sessions = new Map<string, ConversationSession>();

  constructor(
    private readonly _context: ConversationContext,
    private readonly _metadata: Record<string, unknown> = {}
  ) {
    ConversationValidator.validateContext(_context);
  }

  public get state(): ConversationState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state !== ConversationState.CREATED) {
      throw new InvalidConversationStateException("initialize", this._state);
    }
    this._state = ConversationState.INITIALIZING;
    try {
      this._initializedAt = new Date();
      this._state = ConversationState.READY;
    } catch (err) {
      this._state = ConversationState.FAILED;
      throw err;
    }
  }

  public async start(): Promise<void> {
    if (this._state !== ConversationState.READY) {
      throw new InvalidConversationStateException("start", this._state);
    }
    try {
      this._startedAt = new Date();
      this._state = ConversationState.RUNNING;

      if (this._context.eventBus) {
        await this._context.eventBus.publish({
          id: "evt-" + Math.random().toString(36).substring(2, 11),
          name: "SessionStarted",
          timestamp: new Date(),
          correlationId: "corr-conv",
          source: "ConversationManager",
          payload: { startedAt: this._startedAt },
          metadata: {},
        });
      }
    } catch (err) {
      this._state = ConversationState.FAILED;
      throw err;
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== ConversationState.RUNNING) {
      throw new InvalidConversationStateException("stop", this._state);
    }
    try {
      this._stoppedAt = new Date();
      this._state = ConversationState.STOPPED;

      if (this._context.eventBus) {
        await this._context.eventBus.publish({
          id: "evt-" + Math.random().toString(36).substring(2, 11),
          name: "SessionStopped",
          timestamp: new Date(),
          correlationId: "corr-conv",
          source: "ConversationManager",
          payload: { stoppedAt: this._stoppedAt },
          metadata: {},
        });
      }
    } catch (err) {
      this._state = ConversationState.FAILED;
      throw err;
    }
  }

  public async createConversation(
    metadata?: ConversationMetadata
  ): Promise<Conversation> {
    if (this._state !== ConversationState.RUNNING && this._state !== ConversationState.READY) {
      throw new InvalidConversationStateException("createConversation", this._state);
    }

    ConversationValidator.validateMetadata(metadata);

    const customId = metadata?.custom?.id as string | undefined;
    const conversationId = customId || "conv-" + generateUUID();

    if (this._conversations.has(conversationId)) {
      throw new ConversationValidationException(
        `Duplicate conversation IDs: Conversation with ID "${conversationId}" already exists.`
      );
    }

    const sessionId = metadata?.sessionReference;
    if (sessionId) {
      const session = this._sessions.get(sessionId);
      if (!session) {
        throw new ConversationValidationException(
          `Invalid session references: Session "${sessionId}" does not exist.`
        );
      }

      // Add conversation ID to session list
      const updatedSession: ConversationSession = {
        ...session,
        conversationIds: [...session.conversationIds, conversationId],
        lastActiveAt: new Date(),
      };
      this._sessions.set(sessionId, updatedSession);
    }

    const conversation: Conversation = {
      id: conversationId,
      sessionId,
      messages: [],
      metadata: metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
    };

    this._conversations.set(conversationId, conversation);

    if (this._context.eventBus) {
      await this._context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "ConversationCreated",
        timestamp: new Date(),
        correlationId: "corr-conv",
        source: "ConversationManager",
        payload: { conversationId, sessionId },
        metadata: {},
      });
    }

    return deepFreeze(conversation);
  }

  public async deleteConversation(
    conversationId: string
  ): Promise<void> {
    if (this._state !== ConversationState.RUNNING && this._state !== ConversationState.READY) {
      throw new InvalidConversationStateException("deleteConversation", this._state);
    }

    const conv = this._conversations.get(conversationId);
    if (!conv || conv.isDeleted) {
      throw new ConversationValidationException(`Conversation with ID "${conversationId}" not found.`);
    }

    const updatedConv: Conversation = {
      ...conv,
      isDeleted: true,
      updatedAt: new Date(),
    };
    this._conversations.set(conversationId, updatedConv);

    if (this._context.messageBus) {
      await this._context.messageBus.publish({
        id: generateUUID(),
        type: "conversation.deleted",
        payload: { conversationId },
      });
    }
  }

  public getConversation(
    conversationId: string
  ): Conversation | undefined {
    const conv = this._conversations.get(conversationId);
    if (!conv || conv.isDeleted) {
      return undefined;
    }
    return deepFreeze(conv);
  }

  public listConversations(): readonly Conversation[] {
    const list = Array.from(this._conversations.values())
      .filter((c) => !c.isDeleted)
      .map((c) => deepFreeze(c));
    return deepFreeze(list);
  }

  public async appendMessage(
    conversationId: string,
    message: ConversationMessage
  ): Promise<void> {
    if (this._state !== ConversationState.RUNNING && this._state !== ConversationState.READY) {
      throw new InvalidConversationStateException("appendMessage", this._state);
    }

    ConversationValidator.validateMessage(message);

    const conv = this._conversations.get(conversationId);
    if (!conv || conv.isDeleted) {
      throw new ConversationValidationException(`Conversation with ID "${conversationId}" not found.`);
    }

    // Check message duplicates
    if (conv.messages.some((m) => m.id === message.id)) {
      throw new ConversationValidationException(`Message with ID "${message.id}" already exists in the conversation.`);
    }

    const updatedMessages = [...conv.messages, message];
    const updatedConv: Conversation = {
      ...conv,
      messages: updatedMessages,
      updatedAt: new Date(),
    };
    this._conversations.set(conversationId, updatedConv);

    // Update active session lastActive
    if (conv.sessionId) {
      const session = this._sessions.get(conv.sessionId);
      if (session) {
        this._sessions.set(conv.sessionId, {
          ...session,
          lastActiveAt: new Date(),
        });
      }
    }

    // Audit and message bus
    if (this._context.observability) {
      this._context.observability.recordMetric({
        name: "conversation.messages",
        type: MetricType.COUNTER,
        value: 1,
        timestamp: new Date(),
        tags: { role: message.role },
      });
    }
    if (this._context.messageBus) {
      await this._context.messageBus.publish({
        id: generateUUID(),
        type: "conversation.message.appended",
        payload: { conversationId, messageId: message.id },
      });
    }

    if (this._context.eventBus) {
      await this._context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "ConversationUpdated",
        timestamp: new Date(),
        correlationId: "corr-conv",
        source: "ConversationManager",
        payload: { conversationId, type: "message.appended", messageId: message.id },
        metadata: {},
      });
    }
  }

  public async editMessage(
    conversationId: string,
    messageId: string,
    content: string
  ): Promise<void> {
    if (this._state !== ConversationState.RUNNING && this._state !== ConversationState.READY) {
      throw new InvalidConversationStateException("editMessage", this._state);
    }

    if (!content || !content.trim()) {
      throw new ConversationValidationException("Empty message content: Message content cannot be empty.");
    }

    const conv = this._conversations.get(conversationId);
    if (!conv || conv.isDeleted) {
      throw new ConversationValidationException(`Conversation with ID "${conversationId}" not found.`);
    }

    const messageIndex = conv.messages.findIndex((m) => m.id === messageId && !m.deleted);
    if (messageIndex === -1) {
      throw new ConversationValidationException(`Active message with ID "${messageId}" not found.`);
    }

    const updatedMessages = [...conv.messages];
    updatedMessages[messageIndex] = {
      ...updatedMessages[messageIndex],
      content,
      edited: true,
    };

    const updatedConv: Conversation = {
      ...conv,
      messages: updatedMessages,
      updatedAt: new Date(),
    };
    this._conversations.set(conversationId, updatedConv);

    if (this._context.eventBus) {
      await this._context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "ConversationUpdated",
        timestamp: new Date(),
        correlationId: "corr-conv",
        source: "ConversationManager",
        payload: { conversationId, type: "message.edited", messageId },
        metadata: {},
      });
    }
  }

  public async softDeleteMessage(
    conversationId: string,
    messageId: string
  ): Promise<void> {
    if (this._state !== ConversationState.RUNNING && this._state !== ConversationState.READY) {
      throw new InvalidConversationStateException("softDeleteMessage", this._state);
    }

    const conv = this._conversations.get(conversationId);
    if (!conv || conv.isDeleted) {
      throw new ConversationValidationException(`Conversation with ID "${conversationId}" not found.`);
    }

    const messageIndex = conv.messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) {
      throw new ConversationValidationException(`Message with ID "${messageId}" not found.`);
    }

    const updatedMessages = [...conv.messages];
    updatedMessages[messageIndex] = {
      ...updatedMessages[messageIndex],
      deleted: true,
    };

    const updatedConv: Conversation = {
      ...conv,
      messages: updatedMessages,
      updatedAt: new Date(),
    };
    this._conversations.set(conversationId, updatedConv);

    if (this._context.eventBus) {
      await this._context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "ConversationUpdated",
        timestamp: new Date(),
        correlationId: "corr-conv",
        source: "ConversationManager",
        payload: { conversationId, type: "message.deleted", messageId },
        metadata: {},
      });
    }
  }

  public history(
    conversationId: string
  ): ConversationHistory {
    const conv = this._conversations.get(conversationId);
    if (!conv || conv.isDeleted) {
      throw new ConversationValidationException(`Conversation with ID "${conversationId}" not found.`);
    }

    // Filter out soft-deleted messages
    const activeMessages = conv.messages.filter((m) => !m.deleted);

    const history: ConversationHistory = {
      conversationId,
      messages: activeMessages.map((m) => ({ ...m })),
      version: conv.messages.length, // version tracks total operations / append count
    };

    return deepFreeze(history);
  }

  public async summarize(
    conversationId: string
  ): Promise<ConversationSummary> {
    if (this._state !== ConversationState.RUNNING && this._state !== ConversationState.READY) {
      throw new InvalidConversationStateException("summarize", this._state);
    }

    const conv = this._conversations.get(conversationId);
    if (!conv || conv.isDeleted) {
      throw new ConversationValidationException(`Conversation with ID "${conversationId}" not found.`);
    }

    const activeMessages = conv.messages.filter((m) => !m.deleted);
    const messageCount = activeMessages.length;

    let firstMessageSnippet = undefined;
    let latestMessageSnippet = undefined;
    let estimatedTokenCount = 0;
    const rolesSet = new Set<string>();

    if (messageCount > 0) {
      const firstMsg = activeMessages[0];
      const latestMsg = activeMessages[messageCount - 1];

      firstMessageSnippet = firstMsg.content.substring(0, 100);
      latestMessageSnippet = latestMsg.content.substring(0, 100);

      activeMessages.forEach((m) => {
        rolesSet.add(m.role);
        estimatedTokenCount += estimateTokens(m.content);
      });
    }

    const summary: ConversationSummary = {
      conversationId,
      firstMessageSnippet,
      latestMessageSnippet,
      messageCount,
      roles: Array.from(rolesSet),
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      estimatedTokenCount,
      tags: conv.metadata?.tags || [],
    };

    return deepFreeze(summary);
  }

  public search(
    query: ConversationSearch
  ): readonly ConversationSearchResult[] {
    ConversationValidator.validateSearch(query);

    const results: ConversationSearchResult[] = [];

    const searchStr = query.query?.toLowerCase();

    for (const conv of this._conversations.values()) {
      if (conv.isDeleted) continue;

      // Filter by conversation ID
      if (query.conversationIds && !query.conversationIds.includes(conv.id)) {
        continue;
      }

      // Filter by tags
      if (query.tags) {
        const convTags = conv.metadata?.tags || [];
        const matchesTag = query.tags.some((t) => convTags.includes(t));
        if (!matchesTag) continue;
      }

      // Filter by session IDs
      if (query.sessionIds) {
        if (!conv.sessionId || !query.sessionIds.includes(conv.sessionId)) {
          continue;
        }
      }

      for (const msg of conv.messages) {
        if (msg.deleted) continue;

        // Filter by roles
        if (query.roles && !query.roles.includes(msg.role)) {
          continue;
        }

        // Filter by startDate
        if (query.startDate && msg.timestamp < query.startDate) {
          continue;
        }

        // Filter by endDate
        if (query.endDate && msg.timestamp > query.endDate) {
          continue;
        }

        // Search text inside content
        let matchesQuery = true;
        let score = 1.0;

        if (searchStr) {
          const contentLower = msg.content.toLowerCase();
          const matchIndex = contentLower.indexOf(searchStr);
          if (matchIndex === -1) {
            matchesQuery = false;
          } else {
            // Deterministic score based on count of occurrences
            const occurrences = contentLower.split(searchStr).length - 1;
            score = occurrences * 10 - matchIndex * 0.1;
          }
        }

        if (matchesQuery) {
          results.push({
            conversationId: conv.id,
            message: { ...msg },
            score,
          });
        }
      }
    }

    // Deterministic sort: score descending, then message timestamp descending, then message id descending
    results.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const timeDiff = b.message.timestamp.getTime() - a.message.timestamp.getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return b.message.id.localeCompare(a.message.id);
    });

    return deepFreeze(results);
  }

  public async createSession(sessionId?: string): Promise<ConversationSession> {
    if (this._state !== ConversationState.RUNNING && this._state !== ConversationState.READY) {
      throw new InvalidConversationStateException("createSession", this._state);
    }

    const sessId = sessionId || "sess-" + generateUUID();

    if (this._sessions.has(sessId)) {
      throw new ConversationValidationException(`Session already exists: Session "${sessId}" already exists.`);
    }

    const session: ConversationSession = {
      id: sessId,
      createdAt: new Date(),
      lastActiveAt: new Date(),
      conversationIds: [],
    };

    this._sessions.set(sessId, session);

    if (this._context.eventBus) {
      await this._context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "SessionStarted",
        timestamp: new Date(),
        correlationId: "corr-conv",
        source: "ConversationManager",
        payload: { sessionId: sessId },
        metadata: {},
      });
    }

    return deepFreeze(session);
  }

  public getSession(sessionId: string): ConversationSession | undefined {
    const session = this._sessions.get(sessionId);
    if (!session) return undefined;
    return deepFreeze(session);
  }

  public snapshot(): ConversationSnapshot {
    let totalMessageCount = 0;
    for (const c of this._conversations.values()) {
      if (!c.isDeleted) {
        totalMessageCount += c.messages.filter((m) => !m.deleted).length;
      }
    }

    const snap: ConversationSnapshot = {
      id: "conversation-manager",
      state: this._state,
      initializedAt: this._initializedAt,
      startedAt: this._startedAt,
      stoppedAt: this._stoppedAt,
      conversationCount: Array.from(this._conversations.values()).filter((c) => !c.isDeleted).length,
      sessionCount: this._sessions.size,
      totalMessageCount,
      metadata: { ...this._metadata },
      timestamp: new Date(),
    };

    return deepFreeze(snap);
  }
}
