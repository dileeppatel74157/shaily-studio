export interface HostManifest {
  readonly version: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
