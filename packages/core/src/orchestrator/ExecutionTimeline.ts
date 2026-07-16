export interface TimelineEvent {
  readonly taskId: string;
  readonly agentId?: string;
  readonly status: string;
  readonly timestamp: Date;
}

export interface ExecutionTimeline {
  readonly events: ReadonlyArray<TimelineEvent>;
}
