import { ProviderRequest } from "@shaily/core";

export class GeminiImageValidator {
  public static validateRequest(request: ProviderRequest): void {
    if (!request.prompt) {
      throw new Error("Gemini Image Provider requires a prompt.");
    }
  }
}
