export interface PlatformMetadata {
  readonly version: string;
  readonly build: string;
  readonly environment: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}
