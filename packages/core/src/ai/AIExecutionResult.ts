import { AIUsage } from "./AIUsage";

export interface AIExecutionResult {
  readonly responseId: string;
  readonly content: string;
  readonly usage: AIUsage;
  readonly toolCalls?: readonly {
    readonly id: string;
    readonly name: string;
    readonly arguments: string;
  }[];
  readonly rawResponse?: any;
}
