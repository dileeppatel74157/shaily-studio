import { StudioModule } from "./StudioModule";

export interface StudioManifest {
  readonly version: string;
  readonly modules: readonly StudioModule[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}
