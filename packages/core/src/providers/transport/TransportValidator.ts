import { TransportRequest } from "./types";
import { ProviderValidationException } from "../types";

export class TransportValidator {
  public static validateRequest(request: TransportRequest): void {
    if (!request) {
      throw new ProviderValidationException("TransportRequest cannot be null or undefined.");
    }
    if (!request.id || request.id.trim() === "") {
      throw new ProviderValidationException("TransportRequest must have a valid non-empty ID.");
    }
    if (!request.url || request.url.trim() === "") {
      throw new ProviderValidationException("TransportRequest must have a valid non-empty URL.");
    }
    if (!request.method) {
      throw new ProviderValidationException("TransportRequest must specify an HTTP method.");
    }
    const validMethods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
    if (!validMethods.includes(request.method)) {
      throw new ProviderValidationException(`Unsupported HTTP method: "${request.method}".`);
    }
  }
}
