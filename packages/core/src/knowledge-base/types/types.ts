import { KnowledgeBaseState } from "./KnowledgeBaseState";

// ─── Custom Exceptions ──────────────────────────────────────────────────────

export class KnowledgeBaseException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class KnowledgeNodeNotFoundException extends KnowledgeBaseException {
  constructor(nodeId: string) {
    super(`Knowledge node with ID "${nodeId}" was not found.`);
  }
}

export class DuplicateKnowledgeNodeException extends KnowledgeBaseException {
  constructor(nodeId: string) {
    super(`Knowledge node with ID "${nodeId}" already exists.`);
  }
}

export class EmbeddingException extends KnowledgeBaseException {
  constructor(message: string) {
    super(`Embedding error: ${message}`);
  }
}

export class GraphException extends KnowledgeBaseException {
  constructor(message: string) {
    super(`Graph error: ${message}`);
  }
}

export class IndexException extends KnowledgeBaseException {
  constructor(message: string) {
    super(`Index error: ${message}`);
  }
}

export class KnowledgeBaseValidationException extends KnowledgeBaseException {
  constructor(message: string) {
    super(message);
  }
}

export class InvalidKnowledgeBaseStateException extends KnowledgeBaseException {
  constructor(action: string, currentState: KnowledgeBaseState) {
    super(`Cannot perform "${action}" when knowledge base state is "${currentState}".`);
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────

export function deepFreeze<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object" && typeof obj !== "function") return obj;
  Object.freeze(obj);
  for (const name of Object.getOwnPropertyNames(obj)) {
    const val = (obj as any)[name];
    if (val && (typeof val === "object" || typeof val === "function") && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

/**
 * Compute cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
