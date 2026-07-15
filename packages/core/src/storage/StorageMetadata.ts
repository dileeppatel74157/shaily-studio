export interface StorageMetadata {
  readonly contentType?: string;
  readonly size: number;
  readonly created: Date;
  readonly updated: Date;
  readonly tags?: readonly string[];
  readonly custom?: Readonly<Record<string, string>>;
}
