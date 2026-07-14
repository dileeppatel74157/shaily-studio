import { ContextWindow } from "./ContextWindow";

export interface RAGSnapshot {
  readonly knowledgeBaseId: string;
  readonly promptsCount: number;
  readonly contextWindow: ContextWindow;
  readonly timestamp: Date;
  readonly metadata: Readonly<Record<string, any>>;
}
