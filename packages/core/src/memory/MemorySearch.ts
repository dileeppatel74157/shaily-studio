import { MemoryType } from "./MemoryType";
import { MemoryScope } from "./MemoryScope";
import { MemoryImportance } from "./MemoryImportance";

export interface MemorySearch {
  readonly query?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly types?: ReadonlyArray<MemoryType>;
  readonly scopes?: ReadonlyArray<MemoryScope>;
  readonly minImportance?: MemoryImportance;
  readonly agentId?: string;
  readonly conversationId?: string;
  readonly startTime?: Date;
  readonly endTime?: Date;
}
