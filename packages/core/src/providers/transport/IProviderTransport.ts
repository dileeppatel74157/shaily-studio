import { TransportRequest, TransportResponse, TransportHealth, TransportSnapshot } from "./types";

export interface IProviderTransport {
  readonly baseUrl: string;
  execute(request: TransportRequest): Promise<TransportResponse>;
  stream(request: TransportRequest): AsyncGenerator<TransportResponse>;
  cancel(requestId: string): Promise<void>;
  health(): Promise<TransportHealth>;
  snapshot(): TransportSnapshot;
}
