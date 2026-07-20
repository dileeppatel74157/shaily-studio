export class AnalyticsException extends Error {
  constructor(message: string, public readonly code: string = "ANALYTICS_ERROR") {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CollectionException extends AnalyticsException {
  constructor(message: string) {
    super(message, "COLLECTION_FAILED");
  }
}

export class AggregationException extends AnalyticsException {
  constructor(message: string) {
    super(message, "AGGREGATION_FAILED");
  }
}

export class ReportingException extends AnalyticsException {
  constructor(message: string) {
    super(message, "REPORTING_FAILED");
  }
}

export class TrendException extends AnalyticsException {
  constructor(message: string) {
    super(message, "TREND_FAILED");
  }
}

export class DatasetException extends AnalyticsException {
  constructor(message: string) {
    super(message, "DATASET_FAILED");
  }
}

export class ValidationException extends AnalyticsException {
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
