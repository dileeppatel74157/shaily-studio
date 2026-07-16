import { ProviderRequest } from "@shaily/core";

export class OpenAIValidator {
  public static validateRequest(request: ProviderRequest): void {
    if (!request.messages && !request.prompt) {
      throw new Error("OpenAI Provider requires a prompt or messages.");
    }
  }
}
