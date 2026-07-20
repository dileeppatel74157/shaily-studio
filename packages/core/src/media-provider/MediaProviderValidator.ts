import { MediaProviderType } from "./MediaProviderType";
import { MediaProviderState } from "./MediaProviderState";
import { MediaType } from "./MediaType";
import { GenerationMode } from "./GenerationMode";
import { MediaQuality } from "./MediaQuality";
import { ProcessingState } from "./ProcessingState";
import {
  MediaRequest,
  ImageGenerationRequest,
  VideoGenerationRequest,
  SpeechRequest,
  MusicRequest,
  SfxRequest,
  SubtitleRequest,
  UpscaleRequest,
  MediaSnapshot,
  ProviderConfiguration,
  ProviderRegistration,
  ValidationIssue,
  MediaValidationReport
} from "./models";
import { InvalidMediaRequestException, MediaProviderException } from "./types";

export class MediaProviderValidator {

  // ─── 1. Prompt Required ──────────────────────────────────────────────────────
  public static validatePrompt(prompt: string): void {
    if (!prompt || prompt.trim().length === 0) {
      throw new InvalidMediaRequestException("Prompt is required for media generation.");
    }
  }

  // ─── 2. Provider Exists ──────────────────────────────────────────────────────
  public static validateProviderExists(type?: MediaProviderType): void {
    if (!type) {
      throw new InvalidMediaRequestException("Media provider must be specified.");
    }
  }

  // ─── 3. Provider Supports Requested Media ────────────────────────────────────
  public static validateProviderCapability(registration: ProviderRegistration, type: MediaType, mode: GenerationMode): void {
    const supportsType = registration.config.capabilities.supportedTypes.includes(type);
    const supportsMode = registration.config.capabilities.supportedModes.includes(mode);
    if (!supportsType || !supportsMode) {
      throw new InvalidMediaRequestException(
        `Provider "${registration.type}" does not support Media Type "${type}" with Generation Mode "${mode}".`
      );
    }
  }

  // ─── 4. Duration > 0 ─────────────────────────────────────────────────────────
  public static validateDuration(durationSeconds?: number): void {
    if (durationSeconds !== undefined && durationSeconds <= 0) {
      throw new InvalidMediaRequestException("Media generation duration must be greater than 0 seconds.");
    }
  }

  // ─── 5. Resolution Valid ─────────────────────────────────────────────────────
  public static validateResolution(resolution?: string): void {
    if (resolution) {
      const validResolutions = ["480p", "720p", "1080p", "4k"];
      if (!validResolutions.includes(resolution.toLowerCase())) {
        throw new InvalidMediaRequestException(`Invalid video resolution: "${resolution}". Supported: ${validResolutions.join(", ")}`);
      }
    }
  }

  // ─── 6. FPS Valid ────────────────────────────────────────────────────────────
  public static validateFps(fps?: number): void {
    if (fps !== undefined) {
      if (fps < 1 || fps > 120) {
        throw new InvalidMediaRequestException("FPS must be between 1 and 120.");
      }
    }
  }

  // ─── 7. Image Size Supported ─────────────────────────────────────────────────
  public static validateImageSize(size?: string): void {
    if (size) {
      const validSizes = ["512x512", "1024x1024", "1024x768", "768x1024"];
      if (!validSizes.includes(size.toLowerCase())) {
        throw new InvalidMediaRequestException(`Invalid image size: "${size}". Supported: ${validSizes.join(", ")}`);
      }
    }
  }

  // ─── 8. Voice Exists ─────────────────────────────────────────────────────────
  public static validateVoiceId(voiceId: string): void {
    if (!voiceId || voiceId.trim().length === 0) {
      throw new InvalidMediaRequestException("Voice ID is required for speech synthesis.");
    }
  }

  // ─── 9. Language Supported ───────────────────────────────────────────────────
  public static validateLanguageCode(languageCode?: string): void {
    if (languageCode) {
      const validCodes = ["en-us", "en-gb", "es-es", "fr-fr", "de-de", "hi-in"];
      if (!validCodes.includes(languageCode.toLowerCase())) {
        throw new InvalidMediaRequestException(`Language code "${languageCode}" is not supported.`);
      }
    }
  }

  // ─── 10. Subtitle Format Valid ───────────────────────────────────────────────
  public static validateSubtitleFormat(format: string): void {
    const validFormats = ["srt", "vtt", "json"];
    if (!validFormats.includes(format.toLowerCase())) {
      throw new InvalidMediaRequestException(`Invalid subtitle format: "${format}". Supported: srt, vtt, json.`);
    }
  }

  // ─── 11. File Size Limits ────────────────────────────────────────────────────
  public static validateFileSize(sizeBytes?: number, maxBytes = 100 * 1024 * 1024): void {
    if (sizeBytes !== undefined && sizeBytes > maxBytes) {
      throw new InvalidMediaRequestException(`File size exceeds maximum limit of ${maxBytes / (1024 * 1024)}MB.`);
    }
  }

  // ─── 12. Immutable Snapshots ─────────────────────────────────────────────────
  public static validateSnapshotImmutability(snapshot: MediaSnapshot): void {
    if (!snapshot) {
      throw new InvalidMediaRequestException("MediaSnapshot is required.");
    }
    if (!snapshot.timestamp) {
      throw new InvalidMediaRequestException("MediaSnapshot timestamp is missing.");
    }
  }

  // ─── 13. Duplicate Provider Detection ────────────────────────────────────────
  public static validateNoDuplicateProvider(existing: MediaProviderType[], type: MediaProviderType): void {
    if (existing.includes(type)) {
      throw new InvalidMediaRequestException(`Media provider "${type}" is already registered.`);
    }
  }

  // ─── 14. Context Validation ──────────────────────────────────────────────────
  public static validateContext(context: any): void {
    if (!context) {
      throw new InvalidMediaRequestException("Context is required.");
    }
    if (typeof context.env !== "string" || !context.env) {
      throw new InvalidMediaRequestException("Context env must be a non-empty string.");
    }
    if (typeof context.namespace !== "string" || !context.namespace) {
      throw new InvalidMediaRequestException("Context namespace must be a non-empty string.");
    }
  }

  // ─── 15. Scale Factor Validation (Upscaling) ─────────────────────────────────
  public static validateScaleFactor(scaleFactor: number): void {
    if (scaleFactor <= 1 || scaleFactor > 8) {
      throw new InvalidMediaRequestException("Scale factor must be between 1.1 and 8.0.");
    }
  }

  // ─── 16. Provider Configuration Validation ──────────────────────────────────
  public static validateProviderConfig(config: ProviderConfiguration): void {
    if (!config) {
      throw new InvalidMediaRequestException("ProviderConfiguration is required.");
    }
    if (!config.provider) {
      throw new InvalidMediaRequestException("Provider type is required.");
    }
    if (!config.capabilities) {
      throw new InvalidMediaRequestException("Provider capabilities are required.");
    }
  }

  // ─── 17. API Key Validation ──────────────────────────────────────────────────
  public static validateApiKey(config: ProviderConfiguration): void {
    if (config.provider !== MediaProviderType.LOCAL && config.provider !== MediaProviderType.CUSTOM) {
      if (!config.apiKey || config.apiKey.trim().length === 0) {
        throw new InvalidMediaRequestException(`API key is required for media provider "${config.provider}".`);
      }
    }
  }

  // ─── 18. Sound Effect Duration ───────────────────────────────────────────────
  public static validateSfxRequest(request: SfxRequest): void {
    if (request.durationSeconds !== undefined && request.durationSeconds > 60) {
      throw new InvalidMediaRequestException("Sound effects cannot exceed 60 seconds.");
    }
  }

  // ─── 19. Media Request Quality validation ────────────────────────────────────
  public static validateMediaQuality(quality?: MediaQuality): void {
    if (quality !== undefined) {
      if (!Object.values(MediaQuality).includes(quality)) {
        throw new InvalidMediaRequestException(`Invalid MediaQuality: "${quality}".`);
      }
    }
  }

  // ─── 20. Provider Registration Validation ────────────────────────────────────
  public static validateProviderRegistration(reg: ProviderRegistration): void {
    if (!reg.id) {
      throw new InvalidMediaRequestException("Provider registration ID is required.");
    }
    if (!reg.type) {
      throw new InvalidMediaRequestException("Provider registration type is required.");
    }
    if (!Object.values(MediaProviderState).includes(reg.state)) {
      throw new InvalidMediaRequestException(`Invalid MediaProviderState: "${reg.state}".`);
    }
  }

  // ─── Comprehensive Report ────────────────────────────────────────────────────
  public static generateReport(config: ProviderConfiguration): MediaValidationReport {
    const issues: ValidationIssue[] = [];

    const check = (rule: string, severity: "ERROR" | "WARNING", fn: () => void) => {
      try {
        fn();
      } catch (err: any) {
        issues.push({
          rule,
          severity,
          message: err.message,
          context: { provider: config.provider }
        });
      }
    };

    check("provider-config", "ERROR", () => MediaProviderValidator.validateProviderConfig(config));
    check("api-key", "ERROR", () => MediaProviderValidator.validateApiKey(config));

    return {
      timestamp: new Date(),
      valid: issues.every(i => i.severity !== "ERROR"),
      issues
    };
  }
}
