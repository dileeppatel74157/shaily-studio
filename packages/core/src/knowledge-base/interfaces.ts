import { KnowledgeBaseState } from "./KnowledgeBaseState";
import { KnowledgeNodeType } from "./KnowledgeNodeType";
import { RelationshipType } from "./RelationshipType";
import { EmbeddingProvider } from "./EmbeddingProvider";
import { IndexStatus } from "./IndexStatus";
import { DocumentType } from "./DocumentType";
import { RetrievalStrategy } from "./RetrievalStrategy";
import { KnowledgeSource } from "./KnowledgeSource";
import {
  KnowledgeNode,
  KnowledgeRelationship,
  KnowledgeGraph,
  StoreKnowledgeRequest,
  StoreKnowledgeResponse,
  RetrievalQuery,
  RetrievalResult,
  RetrievalResponse,
  KnowledgeDocument,
  PromptRecord,
  ConversationRecord,
  DecisionRecord,
  ProviderRecord,
  KnowledgeBaseConfiguration,
  KnowledgeBaseStatistics,
  KnowledgeBaseHealth,
  KnowledgeBaseSnapshot,
  KnowledgeBaseReport,
  VectorEntry,
} from "./models";

// ─── Main Engine Interface ───────────────────────────────────────────────────

export interface IKnowledgeBaseEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  getState(): KnowledgeBaseState;
  getConfig(): KnowledgeBaseConfiguration;

  // Store
  store(request: StoreKnowledgeRequest): Promise<StoreKnowledgeResponse>;
  update(nodeId: string, updates: Partial<KnowledgeNode>): Promise<void>;
  delete(nodeId: string): Promise<void>;
  getNode(nodeId: string): Promise<KnowledgeNode>;
  listNodes(filter?: Partial<Pick<KnowledgeNode, "type" | "source" | "projectId">>): KnowledgeNode[];

  // Retrieve
  retrieve(query: RetrievalQuery): Promise<RetrievalResponse>;

  // Managers
  getVectorManager(): IVectorManager;
  getGraphManager(): IGraphManager;
  getIndexManager(): IIndexManager;
  getRetrievalManager(): IRetrievalManager;
  getDocumentManager(): IDocumentManager;
  getPromptHistoryManager(): IPromptHistoryManager;
  getConversationManager(): IConversationManager;
  getDecisionHistoryManager(): IDecisionHistoryManager;
  getProviderHistoryManager(): IProviderHistoryManager;

  // Reporting
  getReporter(): IKnowledgeBaseReporter;

  // Events
  on(event: string, handler: (payload: any) => void): void;
  off(event: string, handler: (payload: any) => void): void;
  emit(event: string, payload?: any): void;
}

// ─── Sub-manager Interfaces ──────────────────────────────────────────────────

export interface IVectorManager {
  generateEmbedding(text: string): number[];
  storeVector(nodeId: string, embedding: number[]): Promise<void>;
  getVector(nodeId: string): VectorEntry | undefined;
  searchSimilar(queryVector: number[], topK: number, minScore?: number): Array<{ nodeId: string; score: number }>;
  deleteVector(nodeId: string): void;
  getVectorCount(): number;
}

export interface IGraphManager {
  addNode(node: KnowledgeNode): void;
  updateNode(nodeId: string, updates: Partial<KnowledgeNode>): void;
  removeNode(nodeId: string): void;
  addRelationship(rel: KnowledgeRelationship): void;
  removeRelationship(relId: string): void;
  getRelationships(nodeId: string): KnowledgeRelationship[];
  getGraph(): KnowledgeGraph;
  traverse(startNodeId: string, maxDepth?: number): KnowledgeNode[];
  validateNoCycles(): void;
}

export interface IIndexManager {
  indexNode(node: KnowledgeNode): Promise<void>;
  reindexAll(): Promise<void>;
  deleteIndex(nodeId: string): void;
  getIndexStatus(nodeId: string): IndexStatus;
  optimize(): Promise<void>;
}

export interface IRetrievalManager {
  retrieve(query: RetrievalQuery, allNodes: KnowledgeNode[]): Promise<RetrievalResponse>;
  rank(results: RetrievalResult[], query: RetrievalQuery): RetrievalResult[];
  filterByMetadata(nodes: KnowledgeNode[], query: RetrievalQuery): KnowledgeNode[];
}

export interface IDocumentManager {
  importDocument(filePath: string, type: DocumentType, content: string, metadata?: Record<string, any>): Promise<KnowledgeDocument>;
  getDocument(docId: string): KnowledgeDocument | undefined;
  listDocuments(): KnowledgeDocument[];
  deleteDocument(docId: string): void;
  archiveDocument(docId: string): void;
}

export interface IPromptHistoryManager {
  storePrompt(record: Omit<PromptRecord, "id" | "createdAt">): Promise<PromptRecord>;
  getPrompt(promptId: string): PromptRecord | undefined;
  listPrompts(projectId?: string): PromptRecord[];
  searchPrompts(query: string): PromptRecord[];
}

export interface IConversationManager {
  storeMessage(record: Omit<ConversationRecord, "id" | "createdAt">): Promise<ConversationRecord>;
  getSession(sessionId: string): ConversationRecord[];
  summarizeSession(sessionId: string): string;
  listSessions(): string[];
  searchConversations(query: string): ConversationRecord[];
}

export interface IDecisionHistoryManager {
  storeDecision(record: Omit<DecisionRecord, "id" | "createdAt">): Promise<DecisionRecord>;
  getDecision(decisionId: string): DecisionRecord | undefined;
  listDecisions(projectId?: string): DecisionRecord[];
  updateOutcome(decisionId: string, outcome: "SUCCESS" | "FAILURE"): void;
  searchDecisions(query: string): DecisionRecord[];
}

export interface IProviderHistoryManager {
  recordUsage(record: Omit<ProviderRecord, "id" | "createdAt">): Promise<ProviderRecord>;
  getUsageByProvider(provider: string): ProviderRecord[];
  listAll(): ProviderRecord[];
  getAverageLatency(provider: string): number;
  getTotalCost(provider: string): number;
}

export interface IKnowledgeBaseReporter {
  generateReport(): KnowledgeBaseReport;
  getSnapshot(): KnowledgeBaseSnapshot;
}
