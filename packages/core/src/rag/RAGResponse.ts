import { RetrievedDocument } from "./RetrievedDocument";

export interface RAGResponse {
  readonly context: string;
  readonly documents: readonly RetrievedDocument[];
  readonly strategyUsed: string;
  readonly executionTime: number;
  readonly promptText?: string;
}
