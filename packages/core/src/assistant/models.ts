import { AssistantState } from "./AssistantState";
import { IntentType } from "./IntentType";
import { CommandType } from "./CommandType";
import { EntityType } from "./EntityType";
import { ResponseType } from "./ResponseType";
import { PlannerState } from "./PlannerState";
import { ConversationState } from "./ConversationState";
import { ConfidenceLevel } from "./ConfidenceLevel";

export interface Conversation {
  id: string;
  state: ConversationState;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export interface ConversationHistory {
  conversationId: string;
  messages: ConversationMessage[];
}

export interface ConversationContext {
  activeSessionId?: string;
  currentProjectId?: string;
  lastParsedIntent?: ParsedIntent;
  lastResponse?: AssistantResponse;
  variables: Record<string, any>;
}

export interface Intent {
  type: IntentType;
  command: CommandType;
  confidence: number;
}

export interface ParsedIntent {
  rawText: string;
  intent: Intent;
  entities: Entity[];
  slots: Slot[];
  parameters: Parameter[];
  confidence: ConfidenceLevel;
}

export interface Entity {
  value: string;
  type: EntityType;
  startIndex: number;
  endIndex: number;
  confidence: number;
}

export interface Slot {
  name: string;
  value: string;
  entityType?: EntityType;
  required: boolean;
  filled: boolean;
}

export interface Parameter {
  key: string;
  value: any;
}

export interface ExecutionPlan {
  id: string;
  intentType: IntentType;
  state: PlannerState;
  steps: ExecutionStep[];
  costEstimate: number;
  durationEstimateMs: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface ExecutionStep {
  id: string;
  name: string;
  targetEngine: string; // e.g., "ResearchEngine"
  parameters: Record<string, any>;
  dependsOnStepIds: string[];
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  error?: string;
}

export interface PlannerReport {
  timestamp: Date;
  totalPlansCreated: number;
  successfulPlans: number;
  failedPlans: number;
  averageStepsPerPlan: number;
}

export interface PlannerSnapshot {
  timestamp: Date;
  state: PlannerState;
  activePlan?: ExecutionPlan;
  recentPlans: ExecutionPlan[];
}

export interface Assistant {
  id: string;
  name: string;
  state: AssistantState;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssistantRequest {
  command: string;
  sessionId?: string;
  context?: Record<string, any>;
}

export interface AssistantResponse {
  requestId: string;
  sessionId: string;
  text: string;
  type: ResponseType;
  plan?: ExecutionPlan;
  data?: any;
  error?: string;
  timestamp: Date;
}

export interface AssistantSession {
  id: string;
  state: ConversationState;
  context: ConversationContext;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssistantStatistics {
  uptimeMs: number;
  commandsProcessed: number;
  successRate: number;
  averageResponseTimeMs: number;
}

export interface ConversationMemory {
  namespaces: Record<string, Record<string, any>>;
  updatedAt: Date;
}

export interface PromptContext {
  systemPrompt: string;
  recentHistory: ConversationMessage[];
  userPreferences: UserPreferences;
}

export interface UserPreferences {
  defaultOutputFormat: ResponseType;
  preferredVoices?: string[];
  autoExecute: boolean;
}

export interface ExecutionResult {
  planId: string;
  success: boolean;
  outputData?: any;
  error?: string;
  executedStepsCount: number;
}

export interface AssistantReport {
  timestamp: Date;
  state: AssistantState;
  statistics: AssistantStatistics;
  sessionsCount: number;
  activeSessionsCount: number;
}

export interface AssistantSnapshot {
  timestamp: Date;
  state: AssistantState;
  activeSessionId?: string;
  report: AssistantReport;
}

export interface AssistantStateSnapshot {
  timestamp: Date;
  state: AssistantState;
  statistics: AssistantStatistics;
}
