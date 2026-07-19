import { KnowledgeBaseState } from "./KnowledgeBaseState";
import { KnowledgeNodeType } from "./KnowledgeNodeType";
import { RelationshipType } from "./RelationshipType";
import { EmbeddingProvider } from "./EmbeddingProvider";
import { IndexStatus } from "./IndexStatus";
import { DocumentType } from "./DocumentType";
import { RetrievalStrategy } from "./RetrievalStrategy";
import {
  KnowledgeNode,
  KnowledgeRelationship,
  KnowledgeBaseSnapshot,
  RetrievalQuery,
  KnowledgeBaseConfiguration,
} from "./models";
import {
  KnowledgeBaseValidationException,
  InvalidKnowledgeBaseStateException,
  GraphException,
} from "./types";

export class KnowledgeBaseValidator {
  /**
   * 1. Validate identifier syntax.
   */
  public static validateId(id: string, label = "ID"): void {
    if (!id || typeof id !== "string") {
      throw new KnowledgeBaseValidationException(`${label} must be a non-empty string.`);
    }
    if (!/^[a-zA-Z0-9_\-]+$/.test(id)) {
      throw new KnowledgeBaseValidationException(`${label} "${id}" contains illegal characters.`);
    }
  }

  /**
   * 2. Validate KnowledgeNode.
   */
  public static validateKnowledgeNode(node: KnowledgeNode): void {
    if (!node) throw new KnowledgeBaseValidationException("Knowledge node is missing.");
    this.validateId(node.id, "Node ID");
    if (!node.title || typeof node.title !== "string") {
      throw new KnowledgeBaseValidationException("Node title must be a non-empty string.");
    }
    if (!Object.values(KnowledgeNodeType).includes(node.type)) {
      throw new KnowledgeBaseValidationException(`Invalid node type "${node.type}".`);
    }
    if (!Object.values(IndexStatus).includes(node.indexStatus)) {
      throw new KnowledgeBaseValidationException(`Invalid index status "${node.indexStatus}".`);
    }
    if (!Array.isArray(node.tags)) {
      throw new KnowledgeBaseValidationException("Node tags must be an array.");
    }
    if (!node.metadata || typeof node.metadata !== "object") {
      throw new KnowledgeBaseValidationException("Node metadata must be an object.");
    }
  }

  /**
   * 3. Validate relationship.
   */
  public static validateRelationship(rel: KnowledgeRelationship): void {
    if (!rel) throw new KnowledgeBaseValidationException("Relationship is missing.");
    this.validateId(rel.id, "Relationship ID");
    this.validateId(rel.fromNodeId, "From Node ID");
    this.validateId(rel.toNodeId, "To Node ID");
    if (rel.fromNodeId === rel.toNodeId) {
      throw new KnowledgeBaseValidationException("Self-referential relationships are not allowed.");
    }
    if (!Object.values(RelationshipType).includes(rel.type)) {
      throw new KnowledgeBaseValidationException(`Invalid relationship type "${rel.type}".`);
    }
    if (typeof rel.weight !== "number" || rel.weight < 0 || rel.weight > 1) {
      throw new KnowledgeBaseValidationException("Relationship weight must be between 0 and 1.");
    }
  }

  /**
   * 4. Validate no duplicate nodes.
   */
  public static validateNoDuplicateNodes(nodes: KnowledgeNode[], newId: string): void {
    if (nodes.some(n => n.id === newId)) {
      throw new KnowledgeBaseValidationException(`Duplicate knowledge node ID: "${newId}".`);
    }
  }

  /**
   * 5. Validate no duplicate relationships.
   */
  public static validateNoDuplicateRelationships(rels: KnowledgeRelationship[], fromId: string, toId: string, type: RelationshipType): void {
    if (rels.some(r => r.fromNodeId === fromId && r.toNodeId === toId && r.type === type)) {
      throw new KnowledgeBaseValidationException(`Duplicate relationship "${type}" from "${fromId}" to "${toId}".`);
    }
  }

  /**
   * 6. Validate embedding dimensions.
   */
  public static validateEmbeddingDimensions(embedding: number[], expected: number): void {
    if (!Array.isArray(embedding)) {
      throw new KnowledgeBaseValidationException("Embedding must be an array.");
    }
    if (embedding.length !== expected) {
      throw new KnowledgeBaseValidationException(
        `Embedding dimension mismatch: expected ${expected}, got ${embedding.length}.`
      );
    }
    for (const v of embedding) {
      if (typeof v !== "number" || !isFinite(v)) {
        throw new KnowledgeBaseValidationException("Embedding must contain only finite numbers.");
      }
    }
  }

  /**
   * 7. Validate circular relationships (cycle detection).
   */
  public static validateNoCycles(nodes: KnowledgeNode[], relationships: KnowledgeRelationship[]): void {
    const adj = new Map<string, string[]>();
    for (const n of nodes) adj.set(n.id, []);
    for (const r of relationships) {
      const children = adj.get(r.fromNodeId);
      if (children) children.push(r.toNodeId);
    }

    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (id: string): boolean => {
      visited.add(id);
      stack.add(id);
      for (const neighbor of adj.get(id) || []) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (stack.has(neighbor)) {
          return true;
        }
      }
      stack.delete(id);
      return false;
    };

    for (const n of nodes) {
      if (!visited.has(n.id)) {
        if (dfs(n.id)) {
          throw new GraphException("Circular relationship detected in knowledge graph.");
        }
      }
    }
  }

  /**
   * 8. Validate retrieval query.
   */
  public static validateRetrievalQuery(query: RetrievalQuery): void {
    if (!query) throw new KnowledgeBaseValidationException("Retrieval query is missing.");
    if (!query.query || typeof query.query !== "string") {
      throw new KnowledgeBaseValidationException("Query string must be a non-empty string.");
    }
    if (!Object.values(RetrievalStrategy).includes(query.strategy)) {
      throw new KnowledgeBaseValidationException(`Invalid retrieval strategy "${query.strategy}".`);
    }
    if (query.topK !== undefined && (typeof query.topK !== "number" || query.topK <= 0)) {
      throw new KnowledgeBaseValidationException("topK must be a positive number.");
    }
    if (query.minScore !== undefined && (typeof query.minScore !== "number" || query.minScore < 0 || query.minScore > 1)) {
      throw new KnowledgeBaseValidationException("minScore must be between 0 and 1.");
    }
  }

  /**
   * 9. Validate document type.
   */
  public static validateDocumentType(type: DocumentType): void {
    if (!Object.values(DocumentType).includes(type)) {
      throw new KnowledgeBaseValidationException(`Invalid document type "${type}".`);
    }
  }

  /**
   * 10. Validate configuration.
   */
  public static validateConfiguration(config: KnowledgeBaseConfiguration): void {
    if (!config) throw new KnowledgeBaseValidationException("Configuration is missing.");
    if (!Object.values(EmbeddingProvider).includes(config.embeddingProvider)) {
      throw new KnowledgeBaseValidationException(`Invalid embedding provider "${config.embeddingProvider}".`);
    }
    if (typeof config.embeddingDimensions !== "number" || config.embeddingDimensions <= 0) {
      throw new KnowledgeBaseValidationException("embeddingDimensions must be a positive number.");
    }
    if (typeof config.defaultTopK !== "number" || config.defaultTopK <= 0) {
      throw new KnowledgeBaseValidationException("defaultTopK must be a positive number.");
    }
  }

  /**
   * 11. Validate state transition.
   */
  public static validateStateTransition(current: KnowledgeBaseState, target: KnowledgeBaseState): void {
    const allowed: Record<KnowledgeBaseState, KnowledgeBaseState[]> = {
      [KnowledgeBaseState.CREATED]: [KnowledgeBaseState.INITIALIZING, KnowledgeBaseState.FAILED],
      [KnowledgeBaseState.INITIALIZING]: [KnowledgeBaseState.READY, KnowledgeBaseState.FAILED],
      [KnowledgeBaseState.READY]: [KnowledgeBaseState.INDEXING, KnowledgeBaseState.SEARCHING, KnowledgeBaseState.PAUSED, KnowledgeBaseState.STOPPING, KnowledgeBaseState.FAILED],
      [KnowledgeBaseState.INDEXING]: [KnowledgeBaseState.READY, KnowledgeBaseState.FAILED],
      [KnowledgeBaseState.SEARCHING]: [KnowledgeBaseState.READY, KnowledgeBaseState.FAILED],
      [KnowledgeBaseState.PAUSED]: [KnowledgeBaseState.READY, KnowledgeBaseState.STOPPING, KnowledgeBaseState.FAILED],
      [KnowledgeBaseState.STOPPING]: [KnowledgeBaseState.STOPPED, KnowledgeBaseState.FAILED],
      [KnowledgeBaseState.STOPPED]: [KnowledgeBaseState.INITIALIZING, KnowledgeBaseState.FAILED],
      [KnowledgeBaseState.FAILED]: [KnowledgeBaseState.INITIALIZING, KnowledgeBaseState.FAILED],
    };
    if (!allowed[current].includes(target)) {
      throw new InvalidKnowledgeBaseStateException(`transition to ${target}`, current);
    }
  }

  /**
   * 12. Validate snapshot immutability.
   */
  public static validateSnapshotImmutability(snapshot: KnowledgeBaseSnapshot): void {
    if (!snapshot) throw new KnowledgeBaseValidationException("Snapshot is missing.");
    if (!Object.isFrozen(snapshot)) {
      throw new KnowledgeBaseValidationException("KnowledgeBaseSnapshot is not frozen.");
    }
    if (!Object.isFrozen(snapshot.nodes) || snapshot.nodes.some(n => !Object.isFrozen(n))) {
      throw new KnowledgeBaseValidationException("Snapshot nodes are not fully frozen.");
    }
    if (!Object.isFrozen(snapshot.relationships) || snapshot.relationships.some(r => !Object.isFrozen(r))) {
      throw new KnowledgeBaseValidationException("Snapshot relationships are not fully frozen.");
    }
    if (!Object.isFrozen(snapshot.statistics)) {
      throw new KnowledgeBaseValidationException("Snapshot statistics are not frozen.");
    }
  }

  /**
   * 13. Validate graph edge references.
   */
  public static validateGraphEdgeReferences(nodes: KnowledgeNode[], relationships: KnowledgeRelationship[]): void {
    const nodeIds = new Set(nodes.map(n => n.id));
    for (const rel of relationships) {
      if (!nodeIds.has(rel.fromNodeId)) {
        throw new GraphException(`Relationship references unknown source node "${rel.fromNodeId}".`);
      }
      if (!nodeIds.has(rel.toNodeId)) {
        throw new GraphException(`Relationship references unknown target node "${rel.toNodeId}".`);
      }
    }
  }

  /**
   * 14. Validate missing metadata fields.
   */
  public static validateRequiredMetadata(metadata: Record<string, any>, requiredKeys: string[]): void {
    for (const key of requiredKeys) {
      if (!(key in metadata)) {
        throw new KnowledgeBaseValidationException(`Required metadata field "${key}" is missing.`);
      }
    }
  }

  /**
   * 15. Validate index consistency.
   */
  public static validateIndexConsistency(nodes: KnowledgeNode[], indexedIds: Set<string>): void {
    for (const node of nodes) {
      if (node.indexStatus === IndexStatus.INDEXED && !indexedIds.has(node.id)) {
        throw new KnowledgeBaseValidationException(`Node "${node.id}" is marked INDEXED but not present in index.`);
      }
    }
  }
}
