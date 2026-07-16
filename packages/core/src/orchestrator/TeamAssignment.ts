export interface TeamAssignment {
  readonly id: string;
  readonly teamId: string;
  readonly taskId: string;
  readonly agentId: string;
  readonly assignedAt: Date;
}
