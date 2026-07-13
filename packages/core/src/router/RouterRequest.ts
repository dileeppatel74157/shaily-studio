import { ProviderMessage } from "../providers/ProviderRequest";
import { ModelCapabilities } from "./ModelCapability";

export interface RouterRequest {
  readonly prompt?: string;
  readonly messages?: ReadonlyArray<ProviderMessage>;
  readonly attachments?: ReadonlyArray<{
    readonly type: string;
    readonly data: string;
  }>;
  readonly requiredCapabilities?: Partial<ModelCapabilities>;
  readonly preferredProvider?: string;
  readonly preferredModel?: string;
  readonly maxCost?: number;
  readonly maxLatency?: number;
  readonly priority?: number;
  readonly metadata?: Record<string, unknown>;
}
