import { ServiceDescriptor } from "./ServiceDescriptor";

export interface CompositionSnapshot {
  readonly timestamp: Date;
  readonly services: readonly ServiceDescriptor[];
  readonly singletonCount: number;
  readonly scopedCount: number;
  readonly transientCount: number;
  readonly dependencyGraph: Readonly<Record<string, readonly string[]>>;
  readonly metadata: Readonly<Record<string, unknown>>;
}
