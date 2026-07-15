export interface AccessDecision {
  readonly allowed: boolean;
  readonly principalId: string;
  readonly permissionId: string;
  readonly reason: string;
  readonly timestamp: Date;
}
