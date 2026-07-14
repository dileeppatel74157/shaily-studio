export interface GatewayRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, string>>;
  readonly params: Readonly<Record<string, string>>;
  readonly body: any;
  readonly correlationId: string;
}
