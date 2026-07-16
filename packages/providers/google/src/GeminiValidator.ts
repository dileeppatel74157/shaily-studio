import { ProviderRequest } from "@shaily/core";

export class GeminiValidator {
  public static validateRequest(request: ProviderRequest): void {
    if (!request.messages && !request.prompt) {
      throw new Error("Gemini Provider requires a prompt or messages.");
    }
  }
}
