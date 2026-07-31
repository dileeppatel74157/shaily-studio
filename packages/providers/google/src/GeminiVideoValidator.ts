import { ProviderRequest } from "@shaily/core";

export class GeminiVideoValidator {
  public static validateRequest(request: ProviderRequest): void {
    if (!request.prompt) {
      throw new Error("Gemini Video Provider requires a prompt.");
    }
  }
}
