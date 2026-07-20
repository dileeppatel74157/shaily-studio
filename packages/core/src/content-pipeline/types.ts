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
