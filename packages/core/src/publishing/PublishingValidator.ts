import { PublishingRequest, PublishingMetadata, PublishingTarget } from "./models";
import { PublishingState }    from "./PublishingState";
import { PublishingPlatform } from "./PublishingPlatform";
import { PrivacyType }        from "./PrivacyType";
import {
  PublishingValidationException,
  DuplicatePublishingException,
} from "./types";

// ─── Platform Constraints ─────────────────────────────────────────────────────

const PLATFORM_MAX_FILE_SIZE: Record<PublishingPlatform, number> = {
  [PublishingPlatform.YOUTUBE]:   137_438_953_472, // 128 GB
  [PublishingPlatform.INSTAGRAM]: 4_294_967_296,   // 4 GB
  [PublishingPlatform.TIKTOK]:    4_294_967_296,   // 4 GB
  [PublishingPlatform.FACEBOOK]:  10_737_418_240,  // 10 GB
  [PublishingPlatform.X]:         536_870_912,     // 512 MB
  [PublishingPlatform.LINKEDIN]:  5_368_709_120,   // 5 GB
  [PublishingPlatform.RUMBLE]:    10_737_418_240,  // 10 GB
  [PublishingPlatform.CUSTOM]:    Number.MAX_SAFE_INTEGER,
};

const PLATFORM_MAX_DURATION: Record<PublishingPlatform, number> = {
  [PublishingPlatform.YOUTUBE]:   43_200, // 12h
  [PublishingPlatform.INSTAGRAM]: 3_600,  // 60 min (Reels: 15 min enforced via UI)
  [PublishingPlatform.TIKTOK]:    600,    // 10 min
  [PublishingPlatform.FACEBOOK]:  14_400, // 4h
  [PublishingPlatform.X]:         140,    // 2m 20s
  [PublishingPlatform.LINKEDIN]:  600,    // 10 min
  [PublishingPlatform.RUMBLE]:    43_200, // 12h
  [PublishingPlatform.CUSTOM]:    Number.MAX_SAFE_INTEGER,
};

const VALID_TIMEZONES = new Set([
  "UTC", "America/New_York", "America/Los_Angeles", "America/Chicago",
  "America/Denver", "Europe/London", "Europe/Paris", "Europe/Berlin",
  "Asia/Kolkata", "Asia/Tokyo", "Asia/Shanghai", "Asia/Singapore",
  "Australia/Sydney", "Pacific/Auckland",
]);

export class PublishingValidator {

  // ─── Request Validation ─────────────────────────────────────────────────

  public static validateRequest(request: PublishingRequest): void {
    if (!request.id || request.id.trim().length === 0) {
      throw new PublishingValidationException(
        "PublishingRequest must have a non-empty ID."
      );
    }

    if (!request.qualityId || request.qualityId.trim().length === 0) {
      throw new PublishingValidationException(
        `PublishingRequest "${request.id}" must reference a non-empty qualityId.`
      );
    }

    if (!request.renderId || request.renderId.trim().length === 0) {
      throw new PublishingValidationException(
        `PublishingRequest "${request.id}" must reference a non-empty renderId.`
      );
    }

    // At least one target required
    if (!request.targets || request.targets.length === 0) {
      throw new PublishingValidationException(
        `PublishingRequest "${request.id}" must have at least one publishing target.`
      );
    }

    // Validate each target
    this.validateTargets(request.targets);

    // Validate schedule
    if (request.schedule) {
      this.validateSchedule(request.schedule, request.id);
    }

    // Validate retry limit
    if (request.options?.maxRetries !== undefined && request.options.maxRetries > 10) {
      throw new PublishingValidationException(
        `PublishingRequest "${request.id}" maxRetries cannot exceed 10.`
      );
    }
  }

  // ─── Target Validation ───────────────────────────────────────────────────

  public static validateTargets(targets: PublishingTarget[]): void {
    const seenIds   = new Set<string>();
    const seenCombos = new Set<string>();

    for (const target of targets) {
      if (!target.id || target.id.trim().length === 0) {
        throw new PublishingValidationException(
          "Each PublishingTarget must have a non-empty ID."
        );
      }

      // Duplicate target IDs
      if (seenIds.has(target.id)) {
        throw new DuplicatePublishingException(target.id);
      }
      seenIds.add(target.id);

      // Duplicate platform+account combo
      const combo = `${target.platform}:${target.account?.accountId ?? ""}`;
      if (seenCombos.has(combo)) {
        throw new PublishingValidationException(
          `Duplicate publish target: platform "${target.platform}" with account "${target.account?.accountId}" appears more than once.`
        );
      }
      seenCombos.add(combo);

      // Validate platform
      if (!Object.values(PublishingPlatform).includes(target.platform)) {
        throw new PublishingValidationException(
          `Invalid platform "${target.platform}". Must be one of: ${Object.values(PublishingPlatform).join(", ")}.`
        );
      }

      // Validate privacy
      if (!Object.values(PrivacyType).includes(target.privacy)) {
        throw new PublishingValidationException(
          `Invalid privacy setting "${target.privacy}" for target "${target.id}". ` +
          `Must be one of: ${Object.values(PrivacyType).join(", ")}.`
        );
      }

      // Validate account
      if (!target.account) {
        throw new PublishingValidationException(
          `PublishingTarget "${target.id}" is missing a publishing account.`
        );
      }
      if (!target.account.accountId || target.account.accountId.trim().length === 0) {
        throw new PublishingValidationException(
          `PublishingTarget "${target.id}" has an account with an empty accountId.`
        );
      }
    }
  }

  // ─── Metadata Validation ─────────────────────────────────────────────────

  public static validateMetadata(metadata: PublishingMetadata): void {
    if (!metadata.title || metadata.title.trim().length === 0) {
      throw new PublishingValidationException("PublishingMetadata title must not be empty.");
    }
    if (metadata.title.length > 100) {
      throw new PublishingValidationException(
        `PublishingMetadata title exceeds 100 characters (got ${metadata.title.length}).`
      );
    }
    if (metadata.description && metadata.description.length > 5000) {
      throw new PublishingValidationException(
        `PublishingMetadata description exceeds 5000 characters (got ${metadata.description.length}).`
      );
    }
    if (metadata.tags && metadata.tags.length > 30) {
      throw new PublishingValidationException(
        `PublishingMetadata tags array exceeds 30 entries (got ${metadata.tags.length}).`
      );
    }
  }

  // ─── Schedule Validation ─────────────────────────────────────────────────

  public static validateSchedule(
    schedule: { mode: string; publishAt?: Date; timezone?: string },
    requestId: string
  ): void {
    if (schedule.mode === "scheduled" || schedule.mode === "recurring") {
      if (!schedule.publishAt) {
        throw new PublishingValidationException(
          `PublishingRequest "${requestId}" schedule is in mode "${schedule.mode}" but is missing publishAt.`
        );
      }
      if (schedule.publishAt <= new Date()) {
        throw new PublishingValidationException(
          `PublishingRequest "${requestId}" publishAt must be a future date.`
        );
      }
    }
    if (schedule.timezone && !VALID_TIMEZONES.has(schedule.timezone)) {
      throw new PublishingValidationException(
        `PublishingRequest "${requestId}" has an invalid timezone "${schedule.timezone}". ` +
        `Please use a valid IANA timezone.`
      );
    }
  }

  // ─── File Size & Duration Limit Validation ───────────────────────────────

  public static validateFileSizeForPlatform(
    platform: PublishingPlatform,
    fileSizeBytes: number
  ): void {
    const max = PLATFORM_MAX_FILE_SIZE[platform] ?? Number.MAX_SAFE_INTEGER;
    if (fileSizeBytes > max) {
      throw new PublishingValidationException(
        `File size ${fileSizeBytes} bytes exceeds the maximum allowed for platform ` +
        `"${platform}" (${max} bytes).`
      );
    }
  }

  public static validateDurationForPlatform(
    platform: PublishingPlatform,
    durationSeconds: number
  ): void {
    const max = PLATFORM_MAX_DURATION[platform] ?? Number.MAX_SAFE_INTEGER;
    if (durationSeconds > max) {
      throw new PublishingValidationException(
        `Video duration ${durationSeconds}s exceeds the maximum allowed for platform ` +
        `"${platform}" (${max}s).`
      );
    }
  }

  // ─── State Transition Validation ─────────────────────────────────────────

  private static readonly VALID_TRANSITIONS: Record<PublishingState, PublishingState[]> = {
    [PublishingState.CREATED]:     [PublishingState.INITIALIZED],
    [PublishingState.INITIALIZED]: [PublishingState.PREPARING, PublishingState.CANCELLED],
    [PublishingState.PREPARING]:   [PublishingState.VALIDATING, PublishingState.FAILED, PublishingState.CANCELLED],
    [PublishingState.VALIDATING]:  [PublishingState.SCHEDULING, PublishingState.UPLOADING, PublishingState.FAILED],
    [PublishingState.SCHEDULING]:  [PublishingState.UPLOADING, PublishingState.PUBLISHED, PublishingState.FAILED],
    [PublishingState.UPLOADING]:   [PublishingState.PROCESSING, PublishingState.FAILED, PublishingState.CANCELLED],
    [PublishingState.PROCESSING]:  [PublishingState.PUBLISHED, PublishingState.FAILED],
    [PublishingState.PUBLISHED]:   [],
    [PublishingState.FAILED]:      [PublishingState.PREPARING], // Can retry from FAILED
    [PublishingState.CANCELLED]:   [],
  };

  public static validateStateTransition(
    jobId: string,
    from: PublishingState,
    to: PublishingState
  ): void {
    const allowed = this.VALID_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      throw new PublishingValidationException(
        `Invalid state transition for publishing job "${jobId}": "${from}" → "${to}". ` +
        `Allowed transitions: [${allowed.join(", ")}].`
      );
    }
  }
}
