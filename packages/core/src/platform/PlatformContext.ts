export interface PlatformContext {
  readonly environment: string;
  readonly instanceId: string;
  readonly startedBy: string;
  readonly workingDirectory: string;
  readonly arguments: readonly string[];
  readonly variables: Readonly<Record<string, string>>;
}
