import { UploadRequest, YouTubeValidationReport, YouTubeValidationIssue } from "./models";
import { ValidationException } from "./types";
import { PrivacyStatus } from "./PrivacyStatus";
import { VideoCategory } from "./VideoCategory";

export class YouTubeValidator {
  public static validate(request: UploadRequest): YouTubeValidationReport {
    const issues: YouTubeValidationIssue[] = [];

    // 1. Request ID exists
    if (!request.id || request.id.trim() === "") {
      issues.push({ field: "id", message: "Request ID is required.", severity: "CRITICAL" });
    }

    // 2. Project ID exists
    if (!request.projectId || request.projectId.trim() === "") {
      issues.push({ field: "projectId", message: "Project ID is required.", severity: "CRITICAL" });
    }

    // 3. Title required
    if (!request.title || request.title.trim() === "") {
      issues.push({ field: "title", message: "Title is required.", severity: "CRITICAL" });
    }

    // 4. Title length <= 100 chars
    if (request.title && request.title.length > 100) {
      issues.push({ field: "title", message: "Title must be 100 characters or less.", severity: "CRITICAL" });
    }

    // 5. Description <= 5000 chars
    if (request.description && request.description.length > 5000) {
      issues.push({ field: "description", message: "Description must be 5000 characters or less.", severity: "CRITICAL" });
    }

    // 6. Description contains no html
    if (request.description && (request.description.includes("<") || request.description.includes(">"))) {
      issues.push({ field: "description", message: "Description must not contain HTML tags.", severity: "WARNING" });
    }

    // 7. Thumbnail exists
    if (!request.thumbnailUrl || request.thumbnailUrl.trim() === "") {
      issues.push({ field: "thumbnailUrl", message: "Thumbnail URL is required.", severity: "CRITICAL" });
    }

    // 8. Thumbnail URL is valid
    if (request.thumbnailUrl && !request.thumbnailUrl.startsWith("http")) {
      issues.push({ field: "thumbnailUrl", message: "Thumbnail URL must be a valid HTTP/HTTPS URL.", severity: "CRITICAL" });
    }

    // 9. Video file exists
    if (!request.videoFileUrl || request.videoFileUrl.trim() === "") {
      issues.push({ field: "videoFileUrl", message: "Video file URL is required.", severity: "CRITICAL" });
    }

    // 10. Video file URL is valid
    if (request.videoFileUrl && !request.videoFileUrl.startsWith("http")) {
      issues.push({ field: "videoFileUrl", message: "Video file URL must be a valid HTTP/HTTPS URL.", severity: "CRITICAL" });
    }

    // 11. Category valid
    if (!request.category || !Object.values(VideoCategory).includes(request.category)) {
      issues.push({ field: "category", message: "Category is invalid.", severity: "CRITICAL" });
    }

    // 12. Privacy valid
    if (!request.privacy || !Object.values(PrivacyStatus).includes(request.privacy)) {
      issues.push({ field: "privacy", message: "Privacy status is invalid.", severity: "CRITICAL" });
    }

    // 13. Tags valid
    if (request.tags) {
      for (const t of request.tags) {
        if (!t || t.trim() === "") {
          issues.push({ field: "tags", message: "Tags must not contain empty strings.", severity: "CRITICAL" });
        }
      }
    }

    // 14. At least one tag present
    if (!request.tags || request.tags.length === 0) {
      issues.push({ field: "tags", message: "At least one tag is required.", severity: "WARNING" });
    }

    // 15. Schedule date valid
    if (request.privacy === PrivacyStatus.SCHEDULED) {
      if (!request.scheduleTime) {
        issues.push({ field: "scheduleTime", message: "Schedule time is required for SCHEDULED videos.", severity: "CRITICAL" });
      } else if (request.scheduleTime.getTime() <= Date.now()) {
        issues.push({ field: "scheduleTime", message: "Schedule time must be in the future.", severity: "CRITICAL" });
      }
    }

    // 16. Captions URL valid
    if (request.captionsSrtUrl && !request.captionsSrtUrl.endsWith(".srt") && !request.captionsSrtUrl.endsWith(".vtt")) {
      issues.push({ field: "captionsSrtUrl", message: "Captions URL must point to a .srt or .vtt file.", severity: "CRITICAL" });
    }

    // 17. Analytics seed values positive
    if (request.analyticsSeed) {
      if (request.analyticsSeed.expectedViews < 0) {
        issues.push({ field: "analyticsSeed.expectedViews", message: "Expected views cannot be negative.", severity: "CRITICAL" });
      }
      if (request.analyticsSeed.expectedCtrPercent < 0) {
        issues.push({ field: "analyticsSeed.expectedCtrPercent", message: "Expected CTR cannot be negative.", severity: "CRITICAL" });
      }
    }

    // 18. Title cannot be only whitespace
    if (request.title && request.title.trim() === "") {
      issues.push({ field: "title", message: "Title cannot be empty whitespace.", severity: "CRITICAL" });
    }

    // 19. Tags length limit
    if (request.tags && request.tags.join(",").length > 500) {
      issues.push({ field: "tags", message: "Total tags length cannot exceed 500 characters.", severity: "WARNING" });
    }

    // 20. Description cannot be empty whitespace
    if (request.description && request.description.trim() === "") {
      issues.push({ field: "description", message: "Description cannot be empty whitespace.", severity: "CRITICAL" });
    }

    const valid = !issues.some(i => i.severity === "CRITICAL");
    return {
      valid,
      issues,
      timestamp: new Date()
    };
  }

  public static assertValid(request: UploadRequest): void {
    const report = this.validate(request);
    if (!report.valid) {
      const crit = report.issues.find(i => i.severity === "CRITICAL");
      throw new ValidationException(`Validation failed: ${crit?.message}`);
    }
  }
}
