import { AIUsage } from "./AIUsage";

export interface AIStreamChunk {
  readonly chunkId: string;
  readonly content: string;
  readonly finishReason?: string;
  readonly usage?: AIUsage;
}
