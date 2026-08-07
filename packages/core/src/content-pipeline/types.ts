export class ContentPipelineException extends Error {
  constructor(message: string, public readonly code: string = "CONTENT_PIPELINE_ERROR") {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AssetGenerationException extends ContentPipelineException {
  constructor(message: string) {
    super(message, "ASSET_GENERATION_FAILED");
  }
}

export class CompositionException extends ContentPipelineException {
  constructor(message: string) {
    super(message, "COMPOSITION_FAILED");
  }
}

export class RenderException extends ContentPipelineException {
  constructor(message: string) {
    super(message, "RENDER_FAILED");
  }
}

export class QualityException extends ContentPipelineException {
  constructor(message: string) {
    super(message, "QUALITY_REVIEW_FAILED");
  }
}

export class ValidationException extends ContentPipelineException {
  constructor(message: string) {
    super(message, "VALIDATION_FAILED");
  }
}

export class PipelineExecutionException extends ContentPipelineException {
  constructor(message: string) {
    super(message, "EXECUTION_FAILED");
  }
}

/**
 * Deep freezes an object to make it completely immutable.
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
