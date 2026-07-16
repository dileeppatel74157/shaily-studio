import { ProviderRequest } from "@shaily/core";

export class OllamaValidator {
  public static validateRequest(request: ProviderRequest): void {
    if (!request.messages && !request.prompt) {
      throw new Error("Ollama Provider requires a prompt or messages.");
    }
  }
}
