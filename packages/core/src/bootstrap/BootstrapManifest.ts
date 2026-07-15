import { BootstrapModule } from "./BootstrapModule";

export interface BootstrapManifest {
  readonly version: string;
  readonly modules: readonly BootstrapModule[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}
