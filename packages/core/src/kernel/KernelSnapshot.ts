import { KernelState } from "./KernelState";
import { KernelModule } from "./KernelModule";
import { DependencyGraph } from "./DependencyGraph";

export interface KernelSnapshot {
  readonly timestamp: Date;
  readonly state: KernelState;
  readonly modules: readonly KernelModule[];
  readonly dependencyGraph: DependencyGraph;
  readonly startupOrder: readonly string[];
  readonly shutdownOrder: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
}
