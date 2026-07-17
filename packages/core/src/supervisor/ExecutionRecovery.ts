export interface ExecutionRecovery {
  readonly id: string;
  readonly sessionId: string;
  readonly strategy: "retry" | "rollback" | "resume" | "restart" | "alternative" | "shutdown";
  readonly error: string;
  readonly checkpointId?: string;
  readonly timestamp: Date;
  readonly success: boolean;
  readonly dependsOnRecoveryId?: string;
}
