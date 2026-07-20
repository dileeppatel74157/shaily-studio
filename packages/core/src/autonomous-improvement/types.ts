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
export function deepFreeze<T extends object>(obj: T): Readonly<T> {
  const propNames = Reflect.ownKeys(obj);

  for (const name of propNames) {
    const value = (obj as any)[name];

    if (value && typeof value === "object") {
      deepFreeze(value);
    }
  }

  return Object.freeze(obj);
}
