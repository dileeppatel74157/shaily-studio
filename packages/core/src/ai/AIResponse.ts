import { AIExecutionResult } from "./AIExecutionResult";

export interface AIResponse {
  readonly responseId: string;
  readonly success: boolean;
  readonly results: readonly AIExecutionResult[];
  readonly error?: string;
  readonly timestamp: Date;
}
