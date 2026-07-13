import { KernelMetadata } from "./KernelMetadata";
import { KernelState } from "./KernelState";

export interface KernelContext {
  readonly metadata: KernelMetadata;
  readonly state: KernelState;
  readonly bootTime: Date | null;
  readonly environment: string;
  readonly serviceCount: number;
  readonly serviceMetadata: ReadonlyArray<{ readonly tokenDescription: string }>;
}
