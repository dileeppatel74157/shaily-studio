import { IProviderTransport } from "./IProviderTransport";
import {
  TransportRequest,
  TransportResponse,
  TransportHealth,
  TransportSnapshot,
  TransportError,
} from "./types";
import { TransportContext } from "./TransportContext";
import { TransportValidator } from "./TransportValidator";
import { deepFreeze } from "../types";

export class ProviderTransport implements IProviderTransport {
  private readonly _activeRequests = new Map<string, AbortController>();
  private _lastSuccess: Date | null = null;
  private _lastFailure: Date | null = null;
  private _successfulCount = 0;
  private _failedCount = 0;
  private _totalLatency = 0;

  constructor(
    public readonly id: string,
    public readonly baseUrl: string,
    public readonly defaultTimeoutMs: number,
    public readonly defaultMaxRetries: number,
    public readonly defaultBackoffFactor: number,
    public readonly defaultHeaders: Readonly<Record<string, string>>,
    public readonly context: TransportContext
  ) {}

  public async execute(request: TransportRequest): Promise<TransportResponse> {
    TransportValidator.validateRequest(request);
    const id = request.id;
    const controller = new AbortController();
    this._activeRequests.set(id, controller);

    const timeoutMs = request.timeout ?? this.defaultTimeoutMs;
    const maxRetries = request.retries ?? this.defaultMaxRetries;
    const backoffFactor = request.backoffFactor ?? this.defaultBackoffFactor;

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    let attempt = 0;
    const startTime = Date.now();

    while (true) {
      try {
        const headers = {
          ...this.defaultHeaders,
          ...request.headers,
        };

        const isJson = headers["content-type"] === "application/json" || headers["Content-Type"] === "application/json";
        const body = isJson && request.body && typeof request.body === "object"
          ? JSON.stringify(request.body)
          : request.body;

        const response = await fetch(request.url, {
          method: request.method,
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        this._activeRequests.delete(id);

        const latency = Date.now() - startTime;

        if (response.status === 429 || response.status === 503) {
          const retryAfterHeader = response.headers.get("retry-after");
          let delayMs = backoffFactor * Math.pow(2, attempt) * 1000;
          if (retryAfterHeader) {
            const parsedSeconds = parseInt(retryAfterHeader, 10);
            if (!isNaN(parsedSeconds)) {
              delayMs = parsedSeconds * 1000;
            } else {
              const parsedDate = Date.parse(retryAfterHeader);
              if (!isNaN(parsedDate)) {
                delayMs = Math.max(0, parsedDate - Date.now());
              }
            }
          }

          if (attempt < maxRetries) {
            attempt++;
            this.context.logger?.warn(`Transport request ${id} got status ${response.status}. Retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries})...`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            continue;
          }
        }

        if (!response.ok) {
          const text = await response.text();
          throw new TransportError(
            `HTTP ${response.status} ${response.statusText}: ${text}`,
            response.status,
            response.statusText,
            text
          );
        }

        const resHeaders: Record<string, string> = {};
        response.headers.forEach((val, key) => {
          resHeaders[key] = val;
        });

        let parsedBody: any;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          parsedBody = await response.json();
        } else {
          parsedBody = await response.text();
        }

        this._lastSuccess = new Date();
        this._successfulCount++;
        this._totalLatency += latency;

        return {
          status: response.status,
          statusText: response.statusText,
          headers: resHeaders,
          body: parsedBody,
          latency,
        };
      } catch (err: any) {
        clearTimeout(timeoutId);
        this._activeRequests.delete(id);

        if (err.name === "AbortError") {
          throw new TransportError(`Request timed out after ${timeoutMs}ms`, 408, "Request Timeout");
        }

        // Retry on network errors
        if (attempt < maxRetries) {
          attempt++;
          const delayMs = backoffFactor * Math.pow(2, attempt) * 1000;
          this.context.logger?.warn(`Transport request ${id} failed with network error: ${err.message}. Retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        this._lastFailure = new Date();
        this._failedCount++;
        throw err instanceof TransportError ? err : new TransportError(err.message);
      }
    }
  }

  public async *stream(request: TransportRequest): AsyncGenerator<TransportResponse> {
    TransportValidator.validateRequest(request);
    const id = request.id;
    const controller = new AbortController();
    this._activeRequests.set(id, controller);

    const timeoutMs = request.timeout ?? this.defaultTimeoutMs;
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    const headers = {
      ...this.defaultHeaders,
      ...request.headers,
    };

    const isJson = headers["content-type"] === "application/json" || headers["Content-Type"] === "application/json";
    const body = isJson && request.body && typeof request.body === "object"
      ? JSON.stringify(request.body)
      : request.body;

    const startTime = Date.now();
    let response: Response;

    try {
      response = await fetch(request.url, {
        method: request.method,
        headers,
        body,
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      this._activeRequests.delete(id);
      this._lastFailure = new Date();
      this._failedCount++;
      if (err.name === "AbortError") {
        throw new TransportError(`Request timed out after ${timeoutMs}ms`, 408, "Request Timeout");
      }
      throw new TransportError(err.message);
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      this._activeRequests.delete(id);
      this._lastFailure = new Date();
      this._failedCount++;
      const text = await response.text();
      throw new TransportError(
        `HTTP ${response.status} ${response.statusText}: ${text}`,
        response.status,
        response.statusText,
        text
      );
    }

    if (!response.body) {
      this._activeRequests.delete(id);
      this._lastFailure = new Date();
      this._failedCount++;
      throw new TransportError("Response body is not readable.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // SSE format vs Raw JSON lines (Ollama)
          let dataText = trimmed;
          if (trimmed.startsWith("data:")) {
            dataText = trimmed.substring(5).trim();
            if (dataText === "[DONE]") {
              break;
            }
          }

          let parsedBody: any = dataText;
          try {
            parsedBody = JSON.parse(dataText);
          } catch (_) {
            // Keep as string if parsing fails
          }

          const resHeaders: Record<string, string> = {};
          response.headers.forEach((val, key) => {
            resHeaders[key] = val;
          });

          this._lastSuccess = new Date();
          this._successfulCount++;

          yield {
            status: response.status,
            statusText: response.statusText,
            headers: resHeaders,
            body: parsedBody,
            latency: Date.now() - startTime,
          };
        }
      }

      // Handle remaining buffer
      if (buffer.trim()) {
        let dataText = buffer.trim();
        if (dataText.startsWith("data:")) {
          dataText = dataText.substring(5).trim();
        }

        if (dataText !== "[DONE]") {
          let parsedBody: any = dataText;
          try {
            parsedBody = JSON.parse(dataText);
          } catch (_) {
            // Keep as string
          }

          const resHeaders: Record<string, string> = {};
          response.headers.forEach((val, key) => {
            resHeaders[key] = val;
          });

          yield {
            status: response.status,
            statusText: response.statusText,
            headers: resHeaders,
            body: parsedBody,
            latency: Date.now() - startTime,
          };
        }
      }
    } catch (err: any) {
      this._lastFailure = new Date();
      this._failedCount++;
      throw err;
    } finally {
      this._activeRequests.delete(id);
    }
  }

  public async cancel(requestId: string): Promise<void> {
    const controller = this._activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this._activeRequests.delete(requestId);
    }
  }

  public async health(): Promise<TransportHealth> {
    const errorRate = this._successfulCount + this._failedCount === 0
      ? 0
      : this._failedCount / (this._successfulCount + this._failedCount);

    const isHealthy = errorRate < 0.5 && (this._lastFailure === null || (this._lastSuccess !== null && this._lastSuccess.getTime() > this._lastFailure.getTime()));
    const avgLatency = this._successfulCount === 0 ? 0 : this._totalLatency / this._successfulCount;

    return {
      isHealthy,
      latency: avgLatency,
      lastSuccess: this._lastSuccess,
      lastFailure: this._lastFailure,
      details: {
        successfulCount: this._successfulCount,
        failedCount: this._failedCount,
        activeRequestsCount: this._activeRequests.size,
      },
    };
  }

  public snapshot(): TransportSnapshot {
    let currentHealth: TransportHealth = {
      isHealthy: true,
      latency: 0,
      lastSuccess: null,
      lastFailure: null,
      details: {},
    };

    // Calculate synchronously for snapshot
    const errorRate = this._successfulCount + this._failedCount === 0
      ? 0
      : this._failedCount / (this._successfulCount + this._failedCount);
    const avgLatency = this._successfulCount === 0 ? 0 : this._totalLatency / this._successfulCount;
    currentHealth = {
      isHealthy: errorRate < 0.5,
      latency: avgLatency,
      lastSuccess: this._lastSuccess,
      lastFailure: this._lastFailure,
      details: {
        successfulCount: this._successfulCount,
        failedCount: this._failedCount,
        activeRequestsCount: this._activeRequests.size,
      },
    };

    const snap: TransportSnapshot = {
      id: this.id,
      baseUrl: this.baseUrl,
      timeout: this.defaultTimeoutMs,
      maxRetries: this.defaultMaxRetries,
      health: currentHealth,
      timestamp: new Date(),
    };
    return deepFreeze(snap);
  }
}
