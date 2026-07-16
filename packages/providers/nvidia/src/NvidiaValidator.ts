import { ProviderRequest } from "@shaily/core";

export class NvidiaValidator {
  public static validateRequest(request: ProviderRequest): void {
    if (!request.messages || request.messages.length === 0) {
      throw new Error("NVIDIA Provider requires at least one message.");
    }
  }
}
