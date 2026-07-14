export interface GatewayResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: any;
}
