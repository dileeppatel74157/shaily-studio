import { MemoryState } from "./MemoryState";
import { InvalidMemoryException, MemoryValidationException, InvalidMemoryStateException } from "./types";

export class MemoryValidator {
  // Existing checks (for MemoryStore compatibility)
  public validateKey(key: string): void {
    if (!key || key.trim() === "") {
      throw new InvalidMemoryException("Key cannot be empty.");
    }
  }

  public validateNamespace(namespace: string): void {
    if (!namespace || namespace.trim() === "") {
      throw new InvalidMemoryException("Namespace cannot be empty.");
    }
  }

  public validateValue(value: unknown): void {
    if (value === undefined) {
      throw new InvalidMemoryException("Value cannot be undefined.");
    }
  }

  // New checks (for MemoryEngine compatibility)
  public validateEntry(entry: {
    id: string;
    content: string;
    type: string;
    scope: string;
    importance: string;
  }): void {
    if (!entry) {
      throw new MemoryValidationException("Memory entry cannot be null or undefined.");
    }
    if (!entry.id || entry.id.trim() === "") {
      throw new MemoryValidationException("Memory ID cannot be empty (Duplicate IDs check).");
    }
    if (!entry.content || entry.content.trim() === "") {
      throw new MemoryValidationException("Memory content cannot be empty (Empty entries check).");
    }
    if (!entry.type || entry.type.trim() === "") {
      throw new MemoryValidationException("Memory type cannot be empty.");
    }
    if (!entry.scope || entry.scope.trim() === "") {
      throw new MemoryValidationException("Memory scope cannot be empty.");
    }
    if (!entry.importance || entry.importance.trim() === "") {
      throw new MemoryValidationException("Memory importance cannot be empty.");
    }
  }

  public validateMetadata(metadata: Record<string, unknown>): void {
    if (!metadata) {
      throw new MemoryValidationException("Metadata cannot be null or undefined.");
    }
  }

  public validateStateTransition(current: MemoryState, target: MemoryState): void {
    const allowedTransitions: Record<MemoryState, MemoryState[]> = {
      [MemoryState.CREATED]: [MemoryState.READY, MemoryState.FAILED],
      [MemoryState.READY]: [MemoryState.RUNNING, MemoryState.STOPPED, MemoryState.FAILED],
      [MemoryState.RUNNING]: [MemoryState.STOPPED, MemoryState.FAILED],
      [MemoryState.STOPPED]: [MemoryState.READY, MemoryState.RUNNING],
      [MemoryState.FAILED]: [MemoryState.READY, MemoryState.RUNNING],
    };

    const allowed = allowedTransitions[current] || [];
    if (!allowed.includes(target)) {
      throw new InvalidMemoryStateException("transition", current);
    }
  }

  public validateCircularReferences(obj: any, seen = new Set<any>()): void {
    if (obj && typeof obj === "object") {
      if (seen.has(obj)) {
        throw new MemoryValidationException("Circular reference detected in memory entry (Circular references).");
      }
      seen.add(obj);
      for (const key of Object.keys(obj)) {
        this.validateCircularReferences(obj[key], seen);
      }
      seen.delete(obj);
    }
  }
}
