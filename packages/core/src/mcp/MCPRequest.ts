export interface MCPRequest {
  readonly method: string;
  readonly params?: Readonly<Record<string, any>>;
  readonly id: string | number;
}
