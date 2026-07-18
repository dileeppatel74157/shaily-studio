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

export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== "object") return obj;
  Object.getOwnPropertyNames(obj).forEach(name => {
    const val = (obj as Record<string, unknown>)[name];
    if (val && typeof val === "object") deepFreeze(val);
  });
  return Object.freeze(obj);
}
