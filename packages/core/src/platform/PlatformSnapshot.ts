import { PlatformState } from "./PlatformState";
import { PlatformManifest } from "./PlatformManifest";
import { StudioSnapshot } from "../studio/StudioSnapshot";

export interface PlatformSnapshot {
  readonly state: PlatformState;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly manifest: PlatformManifest;
  readonly startupTimestamp: Date | null;
  readonly shutdownTimestamp: Date | null;
  readonly studio: StudioSnapshot;
}
