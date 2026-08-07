// ─── Learning Engine Exception Hierarchy ──────────────────────────────────────

export class LearningException extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = "LearningException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class PatternException extends LearningException {
  constructor(message: string) {
    super(message, "PATTERN_ERROR");
    this.name = "PatternException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class KnowledgeException extends LearningException {
  constructor(message: string) {
    super(message, "KNOWLEDGE_ERROR");
    this.name = "KnowledgeException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RecommendationException extends LearningException {
  constructor(message: string) {
    super(message, "RECOMMENDATION_ERROR");
    this.name = "RecommendationException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LearningValidationException extends LearningException {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "LearningValidationException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── Deep Freeze Utility ──────────────────────────────────────────────────────

function isPlainObjectOrArray(value: unknown): boolean {
  if (Array.isArray(value)) return true;
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  Object.freeze(obj);

  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = (obj as any)[prop];
    if (isPlainObjectOrArray(value) && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });
  return obj;
}
