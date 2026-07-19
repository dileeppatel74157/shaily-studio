import {
  IKnowledgeBaseEngine,
  IVectorManager,
  IGraphManager,
  IIndexManager,
  IRetrievalManager,
  IDocumentManager,
  IPromptHistoryManager,
  IConversationManager,
  IDecisionHistoryManager,
  IProviderHistoryManager,
  IKnowledgeBaseReporter,
} from "./interfaces";
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
import {
  KnowledgeBaseException,
  KnowledgeNodeNotFoundException,
  DuplicateKnowledgeNodeException,
  EmbeddingException,
  GraphException,
  IndexException,
  KnowledgeBaseValidationException,
  InvalidKnowledgeBaseStateException,
  deepFreeze,
  cosineSimilarity,
} from "./types";
import { KnowledgeBaseValidator } from "./KnowledgeBaseValidator";

// ─── Main Engine ─────────────────────────────────────────────────────────────

export class KnowledgeBaseEngine implements IKnowledgeBaseEngine {
  private _state = KnowledgeBaseState.CREATED;
  private readonly _eventHandlers = new Map<string, Set<(payload: any) => void>>();
  private _bootTime = Date.now();

  // Sub-components
  private readonly _vectorManager: VectorManagerImpl;
  private readonly _graphManager: GraphManagerImpl;
  private readonly _indexManager: IndexManagerImpl;
  private readonly _retrievalManager: RetrievalManagerImpl;
  private readonly _documentManager: DocumentManagerImpl;
  private readonly _promptHistoryManager: PromptHistoryManagerImpl;
  private readonly _conversationManager: ConversationManagerImpl;
  private readonly _decisionHistoryManager: DecisionHistoryManagerImpl;
  private readonly _providerHistoryManager: ProviderHistoryManagerImpl;
  private readonly _reporter: KnowledgeBaseReporterImpl;

  // Node store
  private readonly _nodes = new Map<string, KnowledgeNode>();

  constructor(
    private readonly _context: any,
    private readonly _config: KnowledgeBaseConfiguration,
  ) {
    KnowledgeBaseValidator.validateConfiguration(_config);

    this._vectorManager = new VectorManagerImpl(this);
    this._graphManager = new GraphManagerImpl(this);
    this._indexManager = new IndexManagerImpl(this);
    this._retrievalManager = new RetrievalManagerImpl(this);
    this._documentManager = new DocumentManagerImpl(this);
    this._promptHistoryManager = new PromptHistoryManagerImpl(this);
    this._conversationManager = new ConversationManagerImpl(this);
    this._decisionHistoryManager = new DecisionHistoryManagerImpl(this);
    this._providerHistoryManager = new ProviderHistoryManagerImpl(this);
    this._reporter = new KnowledgeBaseReporterImpl(this);
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  public async initialize(): Promise<void> {
    if (this._state !== KnowledgeBaseState.CREATED && this._state !== KnowledgeBaseState.STOPPED) {
      throw new InvalidKnowledgeBaseStateException("initialize", this._state);
    }
    this._state = KnowledgeBaseState.INITIALIZING;
    await this._log("knowledge", "initialize_start", { ts: new Date() });

    try {
      if (this._config.persistenceEnabled) {
        const saved = await this._get<KnowledgeNode[]>("knowledge", "all_nodes");
        if (saved) {
          for (const n of saved) {
            this._nodes.set(n.id, n);
            this._graphManager.addNode(n);
          }
        }
      }
      this._state = KnowledgeBaseState.READY;
      await this._log("knowledge", "initialize_done", { ts: new Date() });
    } catch (err: any) {
      this._state = KnowledgeBaseState.FAILED;
      throw new KnowledgeBaseException(`Init failed: ${err.message}`);
    }
  }

  public async start(): Promise<void> {
    if (this._state !== KnowledgeBaseState.READY && this._state !== KnowledgeBaseState.STOPPED) {
      throw new InvalidKnowledgeBaseStateException("start", this._state);
    }
    this._state = KnowledgeBaseState.READY;
    this._bootTime = Date.now();
    this.emit("EngineStarted", { ts: new Date() });
    await this._log("knowledge", "start", { ts: new Date() });
  }

  public async stop(): Promise<void> {
    if (this._state === KnowledgeBaseState.STOPPED) return;
    this._state = KnowledgeBaseState.STOPPING;
    if (this._config.persistenceEnabled) {
      await this._log("knowledge", "all_nodes", Array.from(this._nodes.values()));
    }
    this._state = KnowledgeBaseState.STOPPED;
    this.emit("EngineStopped", { ts: new Date() });
  }

  // ─── Core Store/Retrieve ───────────────────────────────────────────────────

  public async store(request: StoreKnowledgeRequest): Promise<StoreKnowledgeResponse> {
    if (this._state !== KnowledgeBaseState.READY) {
      throw new InvalidKnowledgeBaseStateException("store", this._state);
    }

    const nodeId = `kn-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    KnowledgeBaseValidator.validateNoDuplicateNodes(Array.from(this._nodes.values()), nodeId);

    const node: KnowledgeNode = {
      id: nodeId,
      type: request.type,
      title: request.title,
      content: request.content,
      tags: request.tags || [],
      source: request.source,
      projectId: request.projectId,
      workspaceId: request.workspaceId,
      indexStatus: IndexStatus.PENDING,
      metadata: request.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    KnowledgeBaseValidator.validateKnowledgeNode(node);

    // Generate embedding
    let embeddingCreated = false;
    try {
      const embedding = this._vectorManager.generateEmbedding(request.content);
      node.embedding = embedding;
      node.embeddingProvider = this._config.embeddingProvider;
      node.embeddingDimensions = embedding.length;
      await this._vectorManager.storeVector(nodeId, embedding);
      embeddingCreated = true;
      this.emit("EmbeddingCreated", { nodeId });
    } catch {
      // non-fatal
    }

    // Store in graph and node map
    this._nodes.set(nodeId, node);
    this._graphManager.addNode(node);

    // Add requested relationships
    if (request.relationships) {
      for (const relReq of request.relationships) {
        if (this._nodes.has(relReq.toNodeId)) {
          const rel: KnowledgeRelationship = {
            id: `rel-${Date.now()}-${Math.floor(Math.random() * 99999)}`,
            fromNodeId: nodeId,
            toNodeId: relReq.toNodeId,
            type: relReq.type,
            weight: relReq.weight ?? 1.0,
            createdAt: new Date(),
          };
          try {
            KnowledgeBaseValidator.validateRelationship(rel);
            KnowledgeBaseValidator.validateNoDuplicateRelationships(
              this._graphManager.getRelationships(nodeId), nodeId, relReq.toNodeId, relReq.type
            );
            this._graphManager.addRelationship(rel);
            this.emit("GraphUpdated", { nodeId, rel });
          } catch {
            // skip invalid rels
          }
        }
      }
    }

    // Index
    await this._indexManager.indexNode(node);
    const indexed = node.indexStatus === IndexStatus.INDEXED;

    await this._log("knowledge", `node-${nodeId}`, node);
    this.emit("KnowledgeStored", { nodeId, type: node.type });

    return { nodeId, success: true, embeddingCreated, indexed, timestamp: new Date() };
  }

  public async update(nodeId: string, updates: Partial<KnowledgeNode>): Promise<void> {
    const node = await this.getNode(nodeId);
    Object.assign(node, updates, { updatedAt: new Date() });
    KnowledgeBaseValidator.validateKnowledgeNode(node);
    this._graphManager.updateNode(nodeId, node);
    await this._log("knowledge", `node-${nodeId}`, node);
    this.emit("KnowledgeUpdated", { nodeId });
  }

  public async delete(nodeId: string): Promise<void> {
    await this.getNode(nodeId);
    this._nodes.delete(nodeId);
    this._graphManager.removeNode(nodeId);
    this._vectorManager.deleteVector(nodeId);
    this._indexManager.deleteIndex(nodeId);
    this.emit("KnowledgeDeleted", { nodeId });
  }

  public async getNode(nodeId: string): Promise<KnowledgeNode> {
    KnowledgeBaseValidator.validateId(nodeId, "Node ID");
    const node = this._nodes.get(nodeId);
    if (!node) throw new KnowledgeNodeNotFoundException(nodeId);
    return node;
  }

  public listNodes(filter?: Partial<Pick<KnowledgeNode, "type" | "source" | "projectId">>): KnowledgeNode[] {
    let nodes = Array.from(this._nodes.values());
    if (filter) {
      if (filter.type) nodes = nodes.filter(n => n.type === filter.type);
      if (filter.source) nodes = nodes.filter(n => n.source === filter.source);
      if (filter.projectId) nodes = nodes.filter(n => n.projectId === filter.projectId);
    }
    return nodes;
  }

  public async retrieve(query: RetrievalQuery): Promise<RetrievalResponse> {
    if (this._state !== KnowledgeBaseState.READY) {
      throw new InvalidKnowledgeBaseStateException("retrieve", this._state);
    }
    KnowledgeBaseValidator.validateRetrievalQuery(query);
    const allNodes = Array.from(this._nodes.values());
    const response = await this._retrievalManager.retrieve(query, allNodes);
    this.emit("KnowledgeRetrieved", { query: query.query, resultCount: response.totalFound });
    return response;
  }

  // ─── Manager Accessors ─────────────────────────────────────────────────────

  public getVectorManager(): IVectorManager { return this._vectorManager; }
  public getGraphManager(): IGraphManager { return this._graphManager; }
  public getIndexManager(): IIndexManager { return this._indexManager; }
  public getRetrievalManager(): IRetrievalManager { return this._retrievalManager; }
  public getDocumentManager(): IDocumentManager { return this._documentManager; }
  public getPromptHistoryManager(): IPromptHistoryManager { return this._promptHistoryManager; }
  public getConversationManager(): IConversationManager { return this._conversationManager; }
  public getDecisionHistoryManager(): IDecisionHistoryManager { return this._decisionHistoryManager; }
  public getProviderHistoryManager(): IProviderHistoryManager { return this._providerHistoryManager; }
  public getReporter(): IKnowledgeBaseReporter { return this._reporter; }
  public getState(): KnowledgeBaseState { return this._state; }
  public getConfig(): KnowledgeBaseConfiguration { return this._config; }
  public getUptimeMs(): number { return Date.now() - this._bootTime; }
  public getNodeMap(): Map<string, KnowledgeNode> { return this._nodes; }

  // ─── Events ────────────────────────────────────────────────────────────────

  public on(event: string, handler: (payload: any) => void): void {
    if (!this._eventHandlers.has(event)) this._eventHandlers.set(event, new Set());
    this._eventHandlers.get(event)!.add(handler);
  }

  public off(event: string, handler: (payload: any) => void): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  public emit(event: string, payload?: any): void {
    for (const h of this._eventHandlers.get(event) || []) {
      try { h(payload); } catch { /* suppress */ }
    }
    this._log("knowledge", `event-${event}-${Date.now()}`, { event, payload }).catch(() => {});
  }

  // ─── Memory Helpers ────────────────────────────────────────────────────────

  public async _log(ns: string, key: string, value: any): Promise<void> {
    const ms = this._context?.memoryStore;
    if (ms && typeof ms.set === "function") {
      try { await ms.set(ns, key, value); } catch { /* suppress */ }
    }
  }

  public async _get<T>(ns: string, key: string): Promise<T | undefined> {
    const ms = this._context?.memoryStore;
    if (ms && typeof ms.get === "function") {
      try { return await ms.get(ns, key) as T; } catch { return undefined; }
    }
    return undefined;
  }
}

// ─── Vector Manager ───────────────────────────────────────────────────────────

class VectorManagerImpl implements IVectorManager {
  private readonly _store = new Map<string, VectorEntry>();

  constructor(private readonly engine: KnowledgeBaseEngine) {}

  public generateEmbedding(text: string): number[] {
    // Deterministic mock embedding: hash-based floats of configured dimensions
    const dims = this.engine.getConfig().embeddingDimensions;
    const vec: number[] = [];
    for (let i = 0; i < dims; i++) {
      // Simple deterministic hash using char codes + position
      let hash = 0;
      for (let j = 0; j < text.length; j++) {
        hash = (hash * 31 + text.charCodeAt(j) + i) >>> 0;
      }
      vec.push((hash % 1000) / 1000 - 0.5);
    }
    return vec;
  }

  public async storeVector(nodeId: string, embedding: number[]): Promise<void> {
    this._store.set(nodeId, {
      nodeId,
      embedding,
      provider: this.engine.getConfig().embeddingProvider,
      dimensions: embedding.length,
      createdAt: new Date(),
    });
    await this.engine._log("vectors", `vec-${nodeId}`, { nodeId, dims: embedding.length });
  }

  public getVector(nodeId: string): VectorEntry | undefined {
    return this._store.get(nodeId);
  }

  public searchSimilar(queryVector: number[], topK: number, minScore = 0): Array<{ nodeId: string; score: number }> {
    const results: Array<{ nodeId: string; score: number }> = [];
    for (const [nodeId, entry] of this._store) {
      const score = cosineSimilarity(queryVector, entry.embedding);
      if (score >= minScore) results.push({ nodeId, score });
    }
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  public deleteVector(nodeId: string): void {
    this._store.delete(nodeId);
  }

  public getVectorCount(): number {
    return this._store.size;
  }
}

// ─── Graph Manager ─────────────────────────────────────────────────────────────

class GraphManagerImpl implements IGraphManager {
  private readonly _nodes = new Map<string, KnowledgeNode>();
  private readonly _relationships = new Map<string, KnowledgeRelationship>();
  private readonly _adj = new Map<string, string[]>(); // nodeId → [relIds]

  constructor(private readonly engine: KnowledgeBaseEngine) {}

  public addNode(node: KnowledgeNode): void {
    this._nodes.set(node.id, node);
    if (!this._adj.has(node.id)) this._adj.set(node.id, []);
  }

  public updateNode(nodeId: string, updates: Partial<KnowledgeNode>): void {
    const n = this._nodes.get(nodeId);
    if (n) Object.assign(n, updates);
  }

  public removeNode(nodeId: string): void {
    this._nodes.delete(nodeId);
    this._adj.delete(nodeId);
    // Remove all relationships involving this node
    for (const [relId, rel] of this._relationships) {
      if (rel.fromNodeId === nodeId || rel.toNodeId === nodeId) {
        this._relationships.delete(relId);
      }
    }
  }

  public addRelationship(rel: KnowledgeRelationship): void {
    KnowledgeBaseValidator.validateRelationship(rel);
    this._relationships.set(rel.id, rel);
    const adj = this._adj.get(rel.fromNodeId) ?? [];
    adj.push(rel.id);
    this._adj.set(rel.fromNodeId, adj);
    this.engine.emit("GraphUpdated", { relId: rel.id });
    this.engine._log("graph", `rel-${rel.id}`, rel).catch(() => {});
  }

  public removeRelationship(relId: string): void {
    this._relationships.delete(relId);
  }

  public getRelationships(nodeId: string): KnowledgeRelationship[] {
    const relIds = this._adj.get(nodeId) || [];
    return relIds.map(id => this._relationships.get(id)).filter(Boolean) as KnowledgeRelationship[];
  }

  public getGraph(): KnowledgeGraph {
    return {
      nodes: Array.from(this._nodes.values()),
      relationships: Array.from(this._relationships.values()),
    };
  }

  public traverse(startNodeId: string, maxDepth = 3): KnowledgeNode[] {
    const visited = new Set<string>();
    const result: KnowledgeNode[] = [];

    const dfs = (id: string, depth: number) => {
      if (depth > maxDepth || visited.has(id)) return;
      visited.add(id);
      const n = this._nodes.get(id);
      if (n) result.push(n);
      for (const rel of this.getRelationships(id)) {
        dfs(rel.toNodeId, depth + 1);
      }
    };

    dfs(startNodeId, 0);
    return result;
  }

  public validateNoCycles(): void {
    KnowledgeBaseValidator.validateNoCycles(
      Array.from(this._nodes.values()),
      Array.from(this._relationships.values()),
    );
  }
}

// ─── Index Manager ────────────────────────────────────────────────────────────

class IndexManagerImpl implements IIndexManager {
  private readonly _index = new Map<string, IndexStatus>();

  constructor(private readonly engine: KnowledgeBaseEngine) {}

  public async indexNode(node: KnowledgeNode): Promise<void> {
    this._index.set(node.id, IndexStatus.INDEXING);
    node.indexStatus = IndexStatus.INDEXING;
    // Simulate indexing
    await new Promise(r => setTimeout(r, 1));
    this._index.set(node.id, IndexStatus.INDEXED);
    node.indexStatus = IndexStatus.INDEXED;
    this.engine.emit("IndexUpdated", { nodeId: node.id, status: IndexStatus.INDEXED });
    await this.engine._log("knowledge", `index-${node.id}`, { nodeId: node.id, status: IndexStatus.INDEXED });
  }

  public async reindexAll(): Promise<void> {
    for (const node of this.engine.getNodeMap().values()) {
      await this.indexNode(node);
    }
  }

  public deleteIndex(nodeId: string): void {
    this._index.set(nodeId, IndexStatus.DELETED);
  }

  public getIndexStatus(nodeId: string): IndexStatus {
    return this._index.get(nodeId) ?? IndexStatus.PENDING;
  }

  public async optimize(): Promise<void> {
    // Simulate optimization
    await new Promise(r => setTimeout(r, 2));
  }

  public getIndexedIds(): Set<string> {
    const ids = new Set<string>();
    for (const [id, status] of this._index) {
      if (status === IndexStatus.INDEXED) ids.add(id);
    }
    return ids;
  }
}

// ─── Retrieval Manager ────────────────────────────────────────────────────────

class RetrievalManagerImpl implements IRetrievalManager {
  constructor(private readonly engine: KnowledgeBaseEngine) {}

  public async retrieve(query: RetrievalQuery, allNodes: KnowledgeNode[]): Promise<RetrievalResponse> {
    const startMs = Date.now();
    const topK = query.topK ?? this.engine.getConfig().defaultTopK;
    const minScore = query.minScore ?? 0;

    let results: RetrievalResult[] = [];

    let filtered = this.filterByMetadata(allNodes, query);

    if (
      query.strategy === RetrievalStrategy.VECTOR ||
      query.strategy === RetrievalStrategy.SIMILARITY ||
      query.strategy === RetrievalStrategy.HYBRID
    ) {
      const qVec = this.engine.getVectorManager().generateEmbedding(query.query);
      const hits = this.engine.getVectorManager().searchSimilar(qVec, topK, minScore);
      const hitMap = new Map(hits.map(h => [h.nodeId, h.score]));
      for (const node of filtered) {
        if (hitMap.has(node.id)) {
          results.push({ node, score: hitMap.get(node.id)!, strategy: query.strategy });
        }
      }
    }

    if (
      query.strategy === RetrievalStrategy.KEYWORD ||
      query.strategy === RetrievalStrategy.HYBRID
    ) {
      const q = query.query.toLowerCase();
      for (const node of filtered) {
        if (
          node.title.toLowerCase().includes(q) ||
          node.content.toLowerCase().includes(q) ||
          node.tags.some(t => t.toLowerCase().includes(q))
        ) {
          if (!results.some(r => r.node.id === node.id)) {
            results.push({ node, score: 0.5, strategy: RetrievalStrategy.KEYWORD });
          }
        }
      }
    }

    if (query.strategy === RetrievalStrategy.TAG) {
      const tags = query.tags || [query.query];
      for (const node of filtered) {
        if (tags.some(t => node.tags.includes(t))) {
          results.push({ node, score: 1.0, strategy: RetrievalStrategy.TAG });
        }
      }
    }

    if (query.strategy === RetrievalStrategy.RECENT) {
      results = filtered
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, topK)
        .map(n => ({ node: n, score: 1.0, strategy: RetrievalStrategy.RECENT }));
    }

    if (query.strategy === RetrievalStrategy.METADATA) {
      results = filtered
        .slice(0, topK)
        .map(n => ({ node: n, score: 0.8, strategy: RetrievalStrategy.METADATA }));
    }

    results = this.rank(results, query).slice(0, topK);

    return {
      query: query.query,
      results,
      totalFound: results.length,
      durationMs: Date.now() - startMs,
      strategy: query.strategy,
      timestamp: new Date(),
    };
  }

  public rank(results: RetrievalResult[], query: RetrievalQuery): RetrievalResult[] {
    return results.sort((a, b) => {
      if (query.strategy === RetrievalStrategy.HIGHEST_SCORE || query.strategy === RetrievalStrategy.SIMILARITY) {
        return b.score - a.score;
      }
      if (query.strategy === RetrievalStrategy.RECENT) {
        return b.node.updatedAt.getTime() - a.node.updatedAt.getTime();
      }
      return b.score - a.score;
    });
  }

  public filterByMetadata(nodes: KnowledgeNode[], query: RetrievalQuery): KnowledgeNode[] {
    let filtered = nodes;
    if (query.nodeTypes && query.nodeTypes.length > 0) {
      filtered = filtered.filter(n => query.nodeTypes!.includes(n.type));
    }
    if (query.projectId) {
      filtered = filtered.filter(n => n.projectId === query.projectId);
    }
    if (query.workspaceId) {
      filtered = filtered.filter(n => n.workspaceId === query.workspaceId);
    }
    if (query.since) {
      filtered = filtered.filter(n => n.updatedAt >= query.since!);
    }
    return filtered;
  }
}

// ─── Document Manager ─────────────────────────────────────────────────────────

class DocumentManagerImpl implements IDocumentManager {
  private readonly _docs = new Map<string, KnowledgeDocument>();

  constructor(private readonly engine: KnowledgeBaseEngine) {}

  public async importDocument(
    filePath: string,
    type: DocumentType,
    content: string,
    metadata: Record<string, any> = {},
  ): Promise<KnowledgeDocument> {
    KnowledgeBaseValidator.validateDocumentType(type);
    const docId = `doc-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    const doc: KnowledgeDocument = {
      id: docId,
      filePath,
      type,
      title: metadata.title || filePath.split("/").pop() || filePath,
      content,
      wordCount: content.split(/\s+/).length,
      indexStatus: IndexStatus.PENDING,
      metadata,
      importedAt: new Date(),
    };

    this._docs.set(docId, doc);

    // Auto-store as knowledge node
    const storeResponse = await this.engine.store({
      type: KnowledgeNodeType.DOCUMENT,
      title: doc.title,
      content: doc.content,
      source: KnowledgeSource.IMPORTED,
      metadata: { docId, filePath, type },
    });

    doc.nodeId = storeResponse.nodeId;
    doc.indexStatus = storeResponse.indexed ? IndexStatus.INDEXED : IndexStatus.PENDING;
    doc.indexedAt = storeResponse.indexed ? new Date() : undefined;

    this.engine.emit("DocumentIndexed", { docId, nodeId: storeResponse.nodeId });
    await this.engine._log("documents", `doc-${docId}`, doc);

    return doc;
  }

  public getDocument(docId: string): KnowledgeDocument | undefined {
    return this._docs.get(docId);
  }

  public listDocuments(): KnowledgeDocument[] {
    return Array.from(this._docs.values());
  }

  public deleteDocument(docId: string): void {
    this._docs.delete(docId);
  }

  public archiveDocument(docId: string): void {
    const doc = this._docs.get(docId);
    if (doc) doc.indexStatus = IndexStatus.DELETED;
  }
}

// ─── Prompt History Manager ───────────────────────────────────────────────────

class PromptHistoryManagerImpl implements IPromptHistoryManager {
  private readonly _prompts = new Map<string, PromptRecord>();

  constructor(private readonly engine: KnowledgeBaseEngine) {}

  public async storePrompt(record: Omit<PromptRecord, "id" | "createdAt">): Promise<PromptRecord> {
    const id = `prompt-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    const prompt: PromptRecord = { id, createdAt: new Date(), ...record };
    this._prompts.set(id, prompt);
    this.engine.emit("PromptStored", { promptId: id });
    await this.engine._log("prompts", `prompt-${id}`, prompt);
    return prompt;
  }

  public getPrompt(promptId: string): PromptRecord | undefined {
    return this._prompts.get(promptId);
  }

  public listPrompts(projectId?: string): PromptRecord[] {
    const all = Array.from(this._prompts.values());
    return projectId ? all.filter(p => p.projectId === projectId) : all;
  }

  public searchPrompts(query: string): PromptRecord[] {
    const q = query.toLowerCase();
    return Array.from(this._prompts.values()).filter(p =>
      p.prompt.toLowerCase().includes(q) || p.output.toLowerCase().includes(q)
    );
  }
}

// ─── Conversation Manager ─────────────────────────────────────────────────────

class ConversationManagerImpl implements IConversationManager {
  private readonly _messages = new Map<string, ConversationRecord>();

  constructor(private readonly engine: KnowledgeBaseEngine) {}

  public async storeMessage(record: Omit<ConversationRecord, "id" | "createdAt">): Promise<ConversationRecord> {
    const id = `conv-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    const msg: ConversationRecord = { id, createdAt: new Date(), ...record };
    this._messages.set(id, msg);
    this.engine.emit("ConversationStored", { messageId: id, sessionId: record.sessionId });
    await this.engine._log("conversations", `conv-${id}`, msg);
    return msg;
  }

  public getSession(sessionId: string): ConversationRecord[] {
    return Array.from(this._messages.values()).filter(m => m.sessionId === sessionId);
  }

  public summarizeSession(sessionId: string): string {
    const msgs = this.getSession(sessionId);
    return msgs.map(m => `[${m.role}] ${m.content}`).join("\n");
  }

  public listSessions(): string[] {
    return Array.from(new Set(Array.from(this._messages.values()).map(m => m.sessionId)));
  }

  public searchConversations(query: string): ConversationRecord[] {
    const q = query.toLowerCase();
    return Array.from(this._messages.values()).filter(m => m.content.toLowerCase().includes(q));
  }
}

// ─── Decision History Manager ─────────────────────────────────────────────────

class DecisionHistoryManagerImpl implements IDecisionHistoryManager {
  private readonly _decisions = new Map<string, DecisionRecord>();

  constructor(private readonly engine: KnowledgeBaseEngine) {}

  public async storeDecision(record: Omit<DecisionRecord, "id" | "createdAt">): Promise<DecisionRecord> {
    const id = `dec-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    const dec: DecisionRecord = { id, createdAt: new Date(), ...record };
    this._decisions.set(id, dec);
    this.engine.emit("DecisionStored", { decisionId: id });
    await this.engine._log("decisions", `dec-${id}`, dec);
    return dec;
  }

  public getDecision(decisionId: string): DecisionRecord | undefined {
    return this._decisions.get(decisionId);
  }

  public listDecisions(projectId?: string): DecisionRecord[] {
    const all = Array.from(this._decisions.values());
    return projectId ? all.filter(d => d.projectId === projectId) : all;
  }

  public updateOutcome(decisionId: string, outcome: "SUCCESS" | "FAILURE"): void {
    const dec = this._decisions.get(decisionId);
    if (dec) {
      dec.outcome = outcome;
      dec.resolvedAt = new Date();
    }
  }

  public searchDecisions(query: string): DecisionRecord[] {
    const q = query.toLowerCase();
    return Array.from(this._decisions.values()).filter(d =>
      d.decision.toLowerCase().includes(q) || d.reason.toLowerCase().includes(q)
    );
  }
}

// ─── Provider History Manager ─────────────────────────────────────────────────

class ProviderHistoryManagerImpl implements IProviderHistoryManager {
  private readonly _records = new Map<string, ProviderRecord>();

  constructor(private readonly engine: KnowledgeBaseEngine) {}

  public async recordUsage(record: Omit<ProviderRecord, "id" | "createdAt">): Promise<ProviderRecord> {
    const id = `prov-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    const rec: ProviderRecord = { id, createdAt: new Date(), ...record };
    this._records.set(id, rec);
    this.engine.emit("ProviderRecorded", { recordId: id, provider: record.provider });
    await this.engine._log("providers", `prov-${id}`, rec);
    return rec;
  }

  public getUsageByProvider(provider: string): ProviderRecord[] {
    return Array.from(this._records.values()).filter(r => r.provider === provider);
  }

  public listAll(): ProviderRecord[] {
    return Array.from(this._records.values());
  }

  public getAverageLatency(provider: string): number {
    const records = this.getUsageByProvider(provider).filter(r => r.latencyMs !== undefined);
    if (records.length === 0) return 0;
    return records.reduce((sum, r) => sum + (r.latencyMs ?? 0), 0) / records.length;
  }

  public getTotalCost(provider: string): number {
    return this.getUsageByProvider(provider).reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
  }
}

// ─── Reporter ─────────────────────────────────────────────────────────────────

class KnowledgeBaseReporterImpl implements IKnowledgeBaseReporter {
  constructor(private readonly engine: KnowledgeBaseEngine) {}

  public generateReport(): KnowledgeBaseReport {
    const nodes = Array.from(this.engine.getNodeMap().values());
    const graph = this.engine.getGraphManager().getGraph();
    return {
      timestamp: new Date(),
      state: this.engine.getState(),
      statistics: this._buildStats(nodes, graph),
      health: {
        healthy: this.engine.getState() === KnowledgeBaseState.READY,
        indexReady: true,
        embeddingReady: true,
        graphSize: graph.nodes.length,
        lastCheckTime: new Date(),
      },
    };
  }

  public getSnapshot(): KnowledgeBaseSnapshot {
    const nodes = Array.from(this.engine.getNodeMap().values());
    const graph = this.engine.getGraphManager().getGraph();
    const snap: KnowledgeBaseSnapshot = {
      timestamp: new Date(),
      state: this.engine.getState(),
      nodes,
      relationships: graph.relationships,
      statistics: this._buildStats(nodes, graph),
    };
    const cloned = JSON.parse(JSON.stringify(snap));
    cloned.timestamp = new Date(cloned.timestamp);
    for (const n of cloned.nodes) {
      n.createdAt = new Date(n.createdAt);
      n.updatedAt = new Date(n.updatedAt);
    }
    for (const r of cloned.relationships) {
      r.createdAt = new Date(r.createdAt);
    }
    const frozen = deepFreeze(cloned);
    KnowledgeBaseValidator.validateSnapshotImmutability(frozen);
    return frozen;
  }

  private _buildStats(nodes: KnowledgeNode[], graph: KnowledgeGraph): KnowledgeBaseStatistics {
    return {
      totalNodes: nodes.length,
      totalRelationships: graph.relationships.length,
      totalDocuments: this.engine.getDocumentManager().listDocuments().length,
      totalPrompts: this.engine.getPromptHistoryManager().listPrompts().length,
      totalConversations: this.engine.getConversationManager().listSessions().length,
      totalDecisions: this.engine.getDecisionHistoryManager().listDecisions().length,
      totalProviderRecords: this.engine.getProviderHistoryManager().listAll().length,
      indexedNodes: nodes.filter(n => n.indexStatus === IndexStatus.INDEXED).length,
      uptimeMs: this.engine.getUptimeMs(),
    };
  }
}
