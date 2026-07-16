import { ProviderException } from "../types";

export interface TransportRequest {
  readonly id: string;
  readonly url: string;
  readonly method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: any;
  readonly timeout?: number;
  readonly retries?: number;
  readonly backoffFactor?: number;
  readonly isStreaming?: boolean;
}

export interface TransportResponse {
  readonly status: number;
  readonly statusText: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: any;
  readonly latency: number;
}

export interface TransportHealth {
  readonly isHealthy: boolean;
  readonly latency: number;
  readonly lastSuccess?: Date | null;
  readonly lastFailure?: Date | null;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface TransportSnapshot {
  readonly id: string;
  readonly baseUrl: string;
  readonly timeout: number;
  readonly maxRetries: number;
  readonly health: TransportHealth;
  readonly timestamp: Date;
}

export interface TransportCapability {
  readonly streaming: boolean;
  readonly timeout: boolean;
  readonly retry: boolean;
}

export class TransportError extends ProviderException {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly statusText?: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = "TransportError";
  }
}
