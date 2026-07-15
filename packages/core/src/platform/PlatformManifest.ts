export interface PlatformManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly environment: string;
  readonly build: string;
  readonly features: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
}
