export interface PromptMetadata {
  readonly author?: string;
  readonly owner?: string;
  readonly labels?: readonly string[];
  readonly priority?: number;
  readonly created?: Date;
  readonly modified?: Date;
  readonly custom?: Readonly<Record<string, unknown>>;
}
