import { BootstrapState } from "./BootstrapState";
import { BootstrapManifest } from "./BootstrapManifest";
import { BootstrapSequence } from "./BootstrapSequence";

export interface BootstrapSnapshot {
  readonly timestamp: Date;
  readonly state: BootstrapState;
  readonly manifest: BootstrapManifest;
  readonly sequence: BootstrapSequence;
  readonly metadata: Readonly<Record<string, unknown>>;
}
