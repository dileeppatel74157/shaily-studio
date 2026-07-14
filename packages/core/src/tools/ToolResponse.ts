export interface ToolResponse {
  readonly success: boolean;
  readonly output: any;
  readonly metadata: Readonly<Record<string, any>>;
  readonly executionTime: number;
  readonly error: Readonly<Error> | null;
}
