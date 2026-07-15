export interface ProviderMetadata {
  readonly version: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  // Backward compatibility fields
  readonly id?: string;
  readonly name?: string;
  readonly capabilities?: any;
}
