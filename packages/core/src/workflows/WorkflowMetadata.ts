export interface WorkflowMetadata {
  readonly author?: string;
  readonly tags?: readonly string[];
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}
