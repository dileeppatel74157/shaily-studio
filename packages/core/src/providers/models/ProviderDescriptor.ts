import { ProviderType } from "./ProviderType";
import { ProviderFeature } from "./ProviderFeature";

export interface ProviderDescriptor {
  readonly id: string;
  readonly name: string;
  readonly type: ProviderType;
  readonly capabilities: readonly ProviderFeature[];
}
