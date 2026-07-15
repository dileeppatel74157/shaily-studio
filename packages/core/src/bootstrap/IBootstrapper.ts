import { BootstrapManifest } from "./BootstrapManifest";
import { BootstrapSnapshot } from "./BootstrapSnapshot";

export interface IBootstrapper {
  initialize(): Promise<void>;
  bootstrap(): Promise<void>;
  shutdown(): Promise<void>;

  loadManifest(manifest: BootstrapManifest): Promise<void>;
  manifest(): BootstrapManifest;
  snapshot(): BootstrapSnapshot;
}
