import { MemoryType } from "./MemoryType";
import { MemoryScope } from "./MemoryScope";
import { MemoryImportance } from "./MemoryImportance";

export interface MemoryMetadata {
  readonly agentId?: string;
  readonly conversationId?: string;
  readonly workflowId?: string;
  readonly taskId?: string;
  readonly key?: string;
  readonly namespace?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly importance?: MemoryImportance;
  readonly scope?: MemoryScope;
  readonly type?: MemoryType;
  readonly [key: string]: unknown;
}
