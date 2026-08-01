import { ProviderRequest } from "@shaily/core";

export class GeminiVoiceValidator {
  public static validateRequest(request: ProviderRequest): void {
    const voiceParams = (request as any).voiceParams;
    if (!voiceParams) {
      throw new Error("Voice Provider request requires voiceParams.");
    }
    if (voiceParams.mode === "tts") {
      if (!request.prompt) {
        throw new Error("Text-to-Speech request requires a prompt.");
      }
    } else if (voiceParams.mode === "stt") {
      if (!voiceParams.audioUrl) {
        throw new Error("Speech-to-Text request requires an audioUrl.");
      }
    } else {
      throw new Error(`Unsupported voice mode: ${voiceParams.mode}`);
    }
  }
}
