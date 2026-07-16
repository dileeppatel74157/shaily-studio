import { ProviderRequest } from "@shaily/core";

export class GrokValidator {
  public static validateRequest(request: ProviderRequest): void {
    if (!request.messages || request.messages.length === 0) {
      throw new Error("Grok Provider requires at least one message.");
    }
  }
}
