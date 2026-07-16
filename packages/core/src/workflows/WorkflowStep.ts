import { WorkflowCondition } from "./WorkflowCondition";
import { RetrievalStrategy } from "../rag/RetrievalStrategy";

export interface RetryPolicy {
  readonly maxRetries: number;
  readonly delayMs: number;
  readonly backoffFactor?: number;
}

export enum WorkflowStepType {
  PROMPT = "PROMPT",
  AI_COMPLETION = "AI_COMPLETION",
  TOOL_CALL = "TOOL_CALL",
  AGENT_EXECUTION = "AGENT_EXECUTION",
  RAG_RETRIEVAL = "RAG_RETRIEVAL",
  CONDITIONAL_BRANCH = "CONDITIONAL_BRANCH",
  LOOP = "LOOP",
  VARIABLE_ASSIGNMENT = "VARIABLE_ASSIGNMENT",
  DELAY = "DELAY",
  PARALLEL_BRANCH = "PARALLEL_BRANCH",
  SEQUENTIAL_BRANCH = "SEQUENTIAL_BRANCH",
  TERMINATE = "TERMINATE",
}

export interface WorkflowStep {
  readonly id: string;
  readonly name: string;
  readonly type: WorkflowStepType;
  readonly retryPolicy?: RetryPolicy;
  readonly timeoutMs?: number;
  readonly onFailure?: "fail" | "continue" | "rollback";
  readonly rollbackStepId?: string;

  // PROMPT configs
  readonly promptId?: string;
  readonly systemPrompt?: string;
  readonly promptVariables?: Record<string, any>;
  readonly templateText?: string;

  // AI_COMPLETION configs
  readonly modelId?: string;
  readonly providerId?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly responseSchema?: Record<string, any>;

  // TOOL_CALL configs
  readonly toolId?: string;
  readonly parameterMapping?: Record<string, string>;
  readonly resultMapping?: Record<string, string>;

  // AGENT_EXECUTION configs
  readonly agentId?: string;
  readonly agentInputMapping?: Record<string, string>;
  readonly agentOutputMapping?: Record<string, string>;

  // RAG_RETRIEVAL configs
  readonly query?: string;
  readonly strategy?: RetrievalStrategy;
  readonly collection?: string;
  readonly maxChunks?: number;
  readonly maxCharacters?: number;

  // CONDITIONAL_BRANCH configs
  readonly conditions?: readonly WorkflowCondition[];
  readonly conditionMatch?: "AND" | "OR";
  readonly thenSteps?: readonly WorkflowStep[];
  readonly elseSteps?: readonly WorkflowStep[];

  // LOOP configs
  readonly loopCondition?: WorkflowCondition;
  readonly loopSteps?: readonly WorkflowStep[];

  // VARIABLE_ASSIGNMENT configs
  readonly assignments?: readonly {
    readonly variableName: string;
    readonly valueExpression: string;
  }[];

  // DELAY configs
  readonly durationMs?: number;

  // PARALLEL_BRANCH configs
  readonly parallelBranches?: readonly (readonly WorkflowStep[])[];

  // SEQUENTIAL_BRANCH configs
  readonly sequentialSteps?: readonly WorkflowStep[];

  // TERMINATE configs
  readonly terminationStatus?: "COMPLETED" | "FAILED" | "CANCELLED";
  readonly terminationError?: string;
}
