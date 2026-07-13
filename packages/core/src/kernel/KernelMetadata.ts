import { KernelState } from "./KernelState";
import { Version } from "./Version";

export interface KernelMetadata {
  readonly kernelId: string;
  readonly version: Version;
  readonly environment: string;
  readonly createdTime: Date;
  readonly bootTime: Date | null;
  readonly state: KernelState;
}
