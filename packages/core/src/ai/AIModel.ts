import { AICapability } from "./AICapability";

export interface AIModel {
  readonly id: string;
  readonly providerId: string;
  readonly displayName: string;
  readonly capabilities: Readonly<Record<AICapability, boolean>>;
  readonly contextWindow: number;
  readonly maxOutput: number;
  readonly enabled: boolean;
}
