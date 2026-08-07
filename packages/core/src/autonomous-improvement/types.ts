export class AutonomousImprovementException extends Error {
  constructor(message: string, public readonly code: string = "IMPROVEMENT_ERROR") {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LearningException extends AutonomousImprovementException {
  constructor(message: string) {
    super(message, "LEARNING_FAILED");
  }
}

export class OptimizationException extends AutonomousImprovementException {
  constructor(message: string) {
    super(message, "OPTIMIZATION_FAILED");
  }
}

export class ExperimentException extends AutonomousImprovementException {
  constructor(message: string) {
    super(message, "EXPERIMENT_FAILED");
  }
}

export class ConfidenceException extends AutonomousImprovementException {
  constructor(message: string) {
    super(message, "CONFIDENCE_SCORE_INVALID");
  }
}

export class ValidationException extends AutonomousImprovementException {
  constructor(message: string) {
    super(message, "VALIDATION_FAILED");
  }
}

/**
 * Deep freezes an object.
 */
function isPlainObjectOrArray(value: unknown): boolean {
  if (Array.isArray(value)) return true;
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
export function deepFreeze<T extends object>(obj: T): Readonly<T> {
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
