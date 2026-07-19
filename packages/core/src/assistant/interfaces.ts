import { AssistantState } from "./AssistantState";
import { IntentType } from "./IntentType";
import { CommandType } from "./CommandType";
import { EntityType } from "./EntityType";
import { ResponseType } from "./ResponseType";
import { PlannerState } from "./PlannerState";
import { ConversationState } from "./ConversationState";
import { ConfidenceLevel } from "./ConfidenceLevel";
import {
  Conversation,
  ConversationMessage,
  ConversationHistory,
  ConversationContext,
  Intent,
  ParsedIntent,
  Entity,
  Slot,
  Parameter,
  ExecutionPlan,
  ExecutionStep,
  PlannerReport,
  PlannerSnapshot,
  Assistant,
  AssistantRequest,
  AssistantResponse,
  AssistantSession,
  AssistantStatistics,
  ConversationMemory,
  PromptContext,
  UserPreferences,
  ExecutionResult,
  AssistantReport,
  AssistantSnapshot,
  AssistantStateSnapshot
} from "./models";

export interface IAssistantEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  getState(): AssistantState;
  processCommand(command: string, sessionId?: string): Promise<AssistantResponse>;
  
  getIntentParser(): IIntentParser;
  getEntityExtractor(): IEntityExtractor;
  getSlotFiller(): ISlotFiller;
  getPlanner(): ICommandPlanner;
  getConversationManager(): IConversationManager;
  getResponseGenerator(): IResponseGenerator;
  getContextResolver(): IContextResolver;
  getSessionManager(): ISessionManager;
  getReporter(): IAssistantReporter;
  
  getContext(): any;
  on(event: string, handler: (payload: any) => void): void;
  off(event: string, handler: (payload: any) => void): void;
  emit(event: string, payload?: any): void;
}

export interface IIntentParser {
  parseIntent(text: string): Promise<ParsedIntent>;
}

export interface IEntityExtractor {
  extractEntities(text: string): Promise<Entity[]>;
}

export interface ISlotFiller {
  fillSlots(intent: ParsedIntent, text: string): Promise<Slot[]>;
}

export interface ICommandPlanner {
  createPlan(intent: ParsedIntent): Promise<ExecutionPlan>;
  validatePlan(plan: ExecutionPlan): Promise<void>;
  executePlan(plan: ExecutionPlan): Promise<ExecutionResult>;
  getPlannerSnapshot(): PlannerSnapshot;
}

export interface IConversationManager {
  getHistory(sessionId: string): Promise<ConversationHistory>;
  appendMessage(sessionId: string, message: ConversationMessage): Promise<void>;
}

export interface IResponseGenerator {
  generateResponse(result: ExecutionResult, type: ResponseType, plan?: ExecutionPlan): Promise<AssistantResponse>;
  generateTextResponse(text: string, type: ResponseType, sessionId: string): Promise<AssistantResponse>;
}

export interface IContextResolver {
  resolveContext(text: string, sessionId?: string): Promise<ConversationContext>;
}

export interface ISessionManager {
  createSession(): Promise<AssistantSession>;
  getSession(sessionId: string): Promise<AssistantSession>;
  closeSession(sessionId: string): Promise<void>;
  listSessions(): Promise<AssistantSession[]>;
  restoreSession(sessionId: string): Promise<AssistantSession>;
  archiveSession(sessionId: string): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
}

export interface IAssistantReporter {
  generateReport(): AssistantReport;
  getAssistantSnapshot(): AssistantSnapshot;
}
