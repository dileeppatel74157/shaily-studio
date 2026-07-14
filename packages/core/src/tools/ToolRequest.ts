export interface ToolRequest {
  readonly toolId: string;
  readonly input: Readonly<Record<string, any>>;
  readonly metadata: Readonly<Record<string, any>>;
  readonly correlationId: string;
}
