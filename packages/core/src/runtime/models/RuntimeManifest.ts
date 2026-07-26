export interface RuntimeManifest {
  readonly version: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
