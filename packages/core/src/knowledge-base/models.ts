import { KnowledgeBaseState } from "./KnowledgeBaseState";
import { KnowledgeNodeType } from "./KnowledgeNodeType";
import { RelationshipType } from "./RelationshipType";
import { EmbeddingProvider } from "./EmbeddingProvider";
import { IndexStatus } from "./IndexStatus";
import { DocumentType } from "./DocumentType";
import { RetrievalStrategy } from "./RetrievalStrategy";
import { KnowledgeSource } from "./KnowledgeSource";

// ─── Core Knowledge ──────────────────────────────────────────────────────────

export interface KnowledgeNode {
  id: string;
  type: KnowledgeNodeType;
  title: string;
  content: string;
  summary?: string;
  tags: string[];
  source: KnowledgeSource;
  projectId?: string;
  workspaceId?: string;
  embedding?: number[];
  embeddingProvider?: EmbeddingProvider;
  embeddingDimensions?: number;
  indexStatus: IndexStatus;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeRelationship {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  type: RelationshipType;
  weight: number; // 0.0 – 1.0
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  relationships: KnowledgeRelationship[];
}

// ─── Storage Request / Response ──────────────────────────────────────────────

export interface StoreKnowledgeRequest {
  type: KnowledgeNodeType;
  title: string;
  content: string;
  tags?: string[];
  source: KnowledgeSource;
  projectId?: string;
  workspaceId?: string;
  metadata?: Record<string, any>;
  relationships?: Array<{ toNodeId: string; type: RelationshipType; weight?: number }>;
}

export interface StoreKnowledgeResponse {
  nodeId: string;
  success: boolean;
  embeddingCreated: boolean;
  indexed: boolean;
  error?: string;
  timestamp: Date;
}

// ─── Retrieval ────────────────────────────────────────────────────────────────

export interface RetrievalQuery {
  query: string;
  strategy: RetrievalStrategy;
  topK?: number;
  nodeTypes?: KnowledgeNodeType[];
  tags?: string[];
  projectId?: string;
  workspaceId?: string;
  minScore?: number;
  since?: Date;
}

export interface RetrievalResult {
  node: KnowledgeNode;
  score: number;
  strategy: RetrievalStrategy;
}

export interface RetrievalResponse {
  query: string;
  results: RetrievalResult[];
  totalFound: number;
  durationMs: number;
  strategy: RetrievalStrategy;
  timestamp: Date;
}

// ─── Document ────────────────────────────────────────────────────────────────

export interface KnowledgeDocument {
  id: string;
  filePath: string;
  type: DocumentType;
  title: string;
  content: string;
  wordCount: number;
  indexStatus: IndexStatus;
  nodeId?: string; // linked knowledge node
  metadata: Record<string, any>;
  importedAt: Date;
  indexedAt?: Date;
}

// ─── Prompt History ───────────────────────────────────────────────────────────

export interface PromptRecord {
  id: string;
  prompt: string;
  variables: Record<string, any>;
  model: string;
  provider: string;
  output: string;
  score?: number;
  costUsd?: number;
  latencyMs?: number;
  projectId?: string;
  createdAt: Date;
}

// ─── Conversation Memory ──────────────────────────────────────────────────────

export interface ConversationRecord {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  command?: string;
  correction?: string;
  preference?: string;
  projectId?: string;
  createdAt: Date;
}

// ─── Decision Memory ──────────────────────────────────────────────────────────

export interface DecisionRecord {
  id: string;
  decision: string;
  reason: string;
  confidence: number;    // 0.0 – 1.0
  outcome?: "SUCCESS" | "FAILURE" | "PENDING";
  provider?: string;
  retryCount: number;
  projectId?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

// ─── Provider History ─────────────────────────────────────────────────────────

export interface ProviderRecord {
  id: string;
  provider: string; // OPENAI | GEMINI | OLLAMA | RUNWAY | KLING | ELEVENLABS | EDGE_TTS
  operation: string;
  model?: string;
  costUsd?: number;
  latencyMs?: number;
  success: boolean;
  error?: string;
  projectId?: string;
  createdAt: Date;
}

// ─── Engine Config & Stats ────────────────────────────────────────────────────

export interface KnowledgeBaseConfiguration {
  embeddingProvider: EmbeddingProvider;
  embeddingDimensions: number;
  maxNodes?: number;
  defaultTopK: number;
  persistenceEnabled: boolean;
  metadata?: Record<string, any>;
}

export interface KnowledgeBaseStatistics {
  totalNodes: number;
  totalRelationships: number;
  totalDocuments: number;
  totalPrompts: number;
  totalConversations: number;
  totalDecisions: number;
  totalProviderRecords: number;
  indexedNodes: number;
  uptimeMs: number;
}

export interface KnowledgeBaseHealth {
  healthy: boolean;
  indexReady: boolean;
  embeddingReady: boolean;
  graphSize: number;
  lastCheckTime: Date;
}

export interface KnowledgeBaseSnapshot {
  timestamp: Date;
  state: KnowledgeBaseState;
  nodes: KnowledgeNode[];
  relationships: KnowledgeRelationship[];
  statistics: KnowledgeBaseStatistics;
}

export interface KnowledgeBaseReport {
  timestamp: Date;
  state: KnowledgeBaseState;
  statistics: KnowledgeBaseStatistics;
  health: KnowledgeBaseHealth;
}

export interface KnowledgeBaseEvent {
  id: string;
  type: string;
  nodeId?: string;
  payload?: any;
  timestamp: Date;
}

export interface VectorEntry {
  nodeId: string;
  embedding: number[];
  provider: EmbeddingProvider;
  dimensions: number;
  createdAt: Date;
}
