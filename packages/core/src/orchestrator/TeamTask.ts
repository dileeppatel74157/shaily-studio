import { TaskPriority } from "./TaskPriority";

export interface TeamTask {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly priority: TaskPriority;
  readonly dependencies: ReadonlyArray<string>;
  readonly status: "queued" | "running" | "completed" | "failed";
  readonly assigneeId?: string;
  readonly retryCount: number;
  readonly maxRetries: number;
  readonly timeoutMs?: number;
}
