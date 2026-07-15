export interface StorageQuery {
  readonly prefix?: string;
  readonly tags?: readonly string[];
  readonly createdBefore?: Date;
  readonly createdAfter?: Date;
  readonly metadata?: Readonly<Record<string, string>>;
}
