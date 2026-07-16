import { ProviderTransport } from "./ProviderTransport";
import { TransportContext } from "./TransportContext";

export class TransportBuilder {
  private _id?: string;
  private _baseUrl?: string;
  private _timeoutMs = 30000;
  private _maxRetries = 3;
  private _backoffFactor = 1.5;
  private _headers: Record<string, string> = {};
  private _context?: TransportContext;

  public withId(id: string): this {
    this._id = id;
    return this;
  }

  public withBaseUrl(baseUrl: string): this {
    this._baseUrl = baseUrl;
    return this;
  }

  public withTimeout(timeoutMs: number): this {
    this._timeoutMs = timeoutMs;
    return this;
  }

  public withMaxRetries(maxRetries: number): this {
    this._maxRetries = maxRetries;
    return this;
  }

  public withBackoffFactor(backoffFactor: number): this {
    this._backoffFactor = backoffFactor;
    return this;
  }

  public withHeader(name: string, value: string): this {
    this._headers[name] = value;
    return this;
  }

  public withHeaders(headers: Record<string, string>): this {
    this._headers = { ...this._headers, ...headers };
    return this;
  }

  public withContext(context: TransportContext): this {
    this._context = context;
    return this;
  }

  public build(): ProviderTransport {
    if (!this._id) {
      throw new Error("Transport ID is required.");
    }
    if (!this._baseUrl) {
      throw new Error("Base URL is required.");
    }
    if (!this._context) {
      throw new Error("TransportContext is required.");
    }

    return new ProviderTransport(
      this._id,
      this._baseUrl,
      this._timeoutMs,
      this._maxRetries,
      this._backoffFactor,
      this._headers,
      this._context
    );
  }
}
