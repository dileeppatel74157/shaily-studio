import { PublishRequest, SocialValidationReport, SocialValidationIssue } from "./models";
import { ValidationException } from "./types";
import { PlatformType } from "./PlatformType";
import { VisibilityType } from "./VisibilityType";
import { ContentType } from "./ContentType";

export class SocialPlatformValidator {
  public static validate(request: PublishRequest, connectedPlatforms: PlatformType[], registeredPlatforms: PlatformType[]): SocialValidationReport {
    const issues: SocialValidationIssue[] = [];

    // 1. Request ID required
    if (!request.id || request.id.trim() === "") {
      issues.push({ platform: PlatformType.CUSTOM, rule: "REQUEST_ID_REQUIRED", message: "Request ID is required.", severity: "CRITICAL" });
    }

    // 2. Project ID required
    if (!request.projectId || request.projectId.trim() === "") {
      issues.push({ platform: PlatformType.CUSTOM, rule: "PROJECT_ID_REQUIRED", message: "Project ID is required.", severity: "CRITICAL" });
    }

    // 3. Platforms list not empty
    if (!request.platforms || request.platforms.length === 0) {
      issues.push({ platform: PlatformType.CUSTOM, rule: "PLATFORMS_NOT_EMPTY", message: "At least one target platform is required.", severity: "CRITICAL" });
    }

    // 4. Media list not empty
    if (!request.media || request.media.length === 0) {
      issues.push({ platform: PlatformType.CUSTOM, rule: "MEDIA_NOT_EMPTY", message: "Media assets are required for publishing.", severity: "CRITICAL" });
    }

    // 5. Visibility valid
    if (!request.visibility || !Object.values(VisibilityType).includes(request.visibility)) {
      issues.push({ platform: PlatformType.CUSTOM, rule: "VISIBILITY_VALID", message: "Visibility setting is invalid.", severity: "CRITICAL" });
    }

    // 6. Content type valid
    if (!request.contentType || !Object.values(ContentType).includes(request.contentType)) {
      issues.push({ platform: PlatformType.CUSTOM, rule: "CONTENT_TYPE_VALID", message: "Content type is invalid.", severity: "CRITICAL" });
    }

    // 7. Caption cannot be empty whitespace
    if (request.caption && request.caption.trim() === "") {
      issues.push({ platform: PlatformType.CUSTOM, rule: "CAPTION_NOT_WHITESPACE", message: "Caption cannot be empty whitespace.", severity: "CRITICAL" });
    }

    // Platform-specific rules
    for (const p of request.platforms) {
      // 8. Platform availability (registered adapter)
      if (!registeredPlatforms.includes(p)) {
        issues.push({ platform: p, rule: "PLATFORM_AVAILABLE", message: `Platform adapter for ${p} is not registered.`, severity: "CRITICAL" });
      }

      // 9. Account connected
      if (!connectedPlatforms.includes(p)) {
        issues.push({ platform: p, rule: "ACCOUNT_CONNECTED", message: `Account for ${p} is not connected.`, severity: "CRITICAL" });
      }

      // 10. Caption length limits
      if (request.caption) {
        if (p === PlatformType.X && request.caption.length > 280) {
          issues.push({ platform: p, rule: "CAPTION_LENGTH", message: "X caption exceeds 280 characters limit.", severity: "CRITICAL" });
        }
        if (p === PlatformType.INSTAGRAM && request.caption.length > 2200) {
          issues.push({ platform: p, rule: "CAPTION_LENGTH", message: "Instagram caption exceeds 2200 characters limit.", severity: "CRITICAL" });
        }
      }

      // 11. Hashtag count limits
      if (request.hashtags) {
        if (p === PlatformType.INSTAGRAM && request.hashtags.length > 30) {
          issues.push({ platform: p, rule: "HASHTAG_COUNT", message: "Instagram hashtag count exceeds limit of 30.", severity: "CRITICAL" });
        }
        if (p === PlatformType.TIKTOK && request.hashtags.length > 10) {
          issues.push({ platform: p, rule: "HASHTAG_COUNT", message: "TikTok hashtag count exceeds limit of 10.", severity: "WARNING" });
        }
      }

      // 12. Media compatibility
      if (p === PlatformType.TIKTOK && request.contentType !== ContentType.SHORT_VIDEO && request.contentType !== ContentType.REEL) {
        issues.push({ platform: p, rule: "PLATFORM_COMPATIBILITY", message: "TikTok only supports video formats.", severity: "CRITICAL" });
      }
    }

    // 13. Media size validation
    for (const m of request.media) {
      if (m.sizeBytes > 100 * 1024 * 1024) {
        issues.push({ platform: PlatformType.CUSTOM, rule: "MEDIA_SIZE", message: `Media asset ${m.id} exceeds size limit of 100MB.`, severity: "CRITICAL" });
      }
      // 14. Media URL valid HTTP/HTTPS
      if (!m.url.startsWith("http")) {
        issues.push({ platform: PlatformType.CUSTOM, rule: "MEDIA_URL_VALID", message: `Media asset ${m.id} URL must start with HTTP/HTTPS.`, severity: "CRITICAL" });
      }
    }

    // 15. Scheduled time in future
    if (request.visibility === VisibilityType.SCHEDULED) {
      if (!request.scheduleTime) {
        issues.push({ platform: PlatformType.CUSTOM, rule: "SCHEDULE_TIME_REQUIRED", message: "Schedule time is required for scheduled posts.", severity: "CRITICAL" });
      } else if (request.scheduleTime.getTime() <= Date.now()) {
        issues.push({ platform: PlatformType.CUSTOM, rule: "SCHEDULE_TIME_FUTURE", message: "Schedule time must be in the future.", severity: "CRITICAL" });
      }
    }

    // 16. Media types match
    for (const m of request.media) {
      if (!["IMAGE", "VIDEO", "AUDIO"].includes(m.type)) {
        issues.push({ platform: PlatformType.CUSTOM, rule: "MEDIA_TYPE_MATCH", message: `Media asset ${m.id} has invalid media type.`, severity: "CRITICAL" });
      }
    }

    // 17. Duplicate publish prevention check (not done here, handled at engine level)

    // 18. Mentions count validation
    if (request.mentions && request.mentions.length > 20) {
      issues.push({ platform: PlatformType.CUSTOM, rule: "MENTION_COUNT", message: "Mentions count exceeds limit of 20.", severity: "WARNING" });
    }

    // 19. Empty hashtags check
    if (request.hashtags) {
      for (const tag of request.hashtags) {
        if (!tag || tag.trim() === "") {
          issues.push({ platform: PlatformType.CUSTOM, rule: "HASHTAG_VALID", message: "Hashtags cannot contain empty values.", severity: "CRITICAL" });
        }
      }
    }

    // 20. Empty mentions check
    if (request.mentions) {
      for (const men of request.mentions) {
        if (!men || men.trim() === "") {
          issues.push({ platform: PlatformType.CUSTOM, rule: "MENTION_VALID", message: "Mentions cannot contain empty values.", severity: "CRITICAL" });
        }
      }
    }

    const valid = !issues.some(i => i.severity === "CRITICAL");
    return {
      valid,
      issues,
      timestamp: new Date()
    };
  }

  public static assertValid(request: PublishRequest, connectedPlatforms: PlatformType[], registeredPlatforms: PlatformType[]): void {
    const report = this.validate(request, connectedPlatforms, registeredPlatforms);
    if (!report.valid) {
      const crit = report.issues.find(i => i.severity === "CRITICAL");
      throw new ValidationException(`Validation failed: ${crit?.message}`);
    }
  }
}
