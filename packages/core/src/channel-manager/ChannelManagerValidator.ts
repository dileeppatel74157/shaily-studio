import { ChannelManagerRequest, OAuthToken, QueueItem, ScheduledPost } from "./models";
import { ChannelManagerState } from "./ChannelManagerState";
import { PlatformProvider }    from "./PlatformProvider";
import { UploadQueueState }    from "./UploadQueueState";
import {
  ChannelManagerValidationException,
  DuplicateChannelException,
} from "./types";

const VALID_TIMEZONES = new Set([
  "UTC", "America/New_York", "America/Los_Angeles", "America/Chicago",
  "America/Denver", "Europe/London", "Europe/Paris", "Europe/Berlin",
  "Asia/Kolkata", "Asia/Tokyo", "Asia/Shanghai", "Asia/Singapore",
  "Australia/Sydney", "Pacific/Auckland",
]);

export class ChannelManagerValidator {

  // ─── Request Validation ──────────────────────────────────────────────────────

  public static validateRequest(request: ChannelManagerRequest): void {
    if (!request.id || request.id.trim().length === 0) {
      throw new ChannelManagerValidationException("ChannelManagerRequest must have a non-empty ID.");
    }
    const validActions = ["CONNECT","DISCONNECT","SYNC","QUEUE","SCHEDULE","REFRESH_TOKEN","GET_STATUS"];
    if (!validActions.includes(request.action)) {
      throw new ChannelManagerValidationException(
        `Invalid action "${request.action}". Must be one of: ${validActions.join(", ")}.`
      );
    }
    if (request.timestamp > new Date()) {
      throw new ChannelManagerValidationException(
        `ChannelManagerRequest "${request.id}" timestamp cannot be in the future.`
      );
    }
    // Actions that require a channelId
    if (["DISCONNECT","REFRESH_TOKEN"].includes(request.action) && !request.channelId) {
      throw new ChannelManagerValidationException(
        `Action "${request.action}" requires a channelId.`
      );
    }
    // CONNECT requires a provider
    if (request.action === "CONNECT" && !request.provider) {
      throw new ChannelManagerValidationException("CONNECT action requires a provider.");
    }
    if (request.provider && !Object.values(PlatformProvider).includes(request.provider)) {
      throw new ChannelManagerValidationException(
        `Invalid provider "${request.provider}". Must be one of: ${Object.values(PlatformProvider).join(", ")}.`
      );
    }
  }

  // ─── Connect Payload Validation ───────────────────────────────────────────────

  public static validateConnectPayload(request: ChannelManagerRequest): void {
    const payload = request.payload as any;
    if (!payload) {
      throw new ChannelManagerValidationException("CONNECT action requires a payload.");
    }
    if (!payload.accountId || String(payload.accountId).trim().length === 0) {
      throw new ChannelManagerValidationException("CONNECT payload must include a non-empty accountId.");
    }
    if (!payload.accessToken || String(payload.accessToken).trim().length === 0) {
      throw new ChannelManagerValidationException("CONNECT payload must include a non-empty accessToken.");
    }
  }

  // ─── OAuth Token Validation ───────────────────────────────────────────────────

  public static validateOAuthToken(token: OAuthToken, channelId: string): void {
    if (!token.accessToken || token.accessToken.trim().length === 0) {
      throw new ChannelManagerValidationException(
        `Channel "${channelId}": accessToken must be non-empty.`
      );
    }
    if (!token.tokenType || token.tokenType.trim().length === 0) {
      throw new ChannelManagerValidationException(
        `Channel "${channelId}": tokenType must be non-empty.`
      );
    }
    if (!token.expiresAt || !(token.expiresAt instanceof Date)) {
      throw new ChannelManagerValidationException(
        `Channel "${channelId}": expiresAt must be a valid Date.`
      );
    }
    if (token.scopes.length === 0) {
      throw new ChannelManagerValidationException(
        `Channel "${channelId}": OAuth token must include at least one scope.`
      );
    }
  }

  // ─── Queue Item Validation ────────────────────────────────────────────────────

  public static validateQueueItem(item: QueueItem): void {
    if (!item.id || item.id.trim().length === 0) {
      throw new ChannelManagerValidationException("QueueItem must have a non-empty ID.");
    }
    if (!item.channelId || item.channelId.trim().length === 0) {
      throw new ChannelManagerValidationException(`QueueItem "${item.id}" must have a non-empty channelId.`);
    }
    if (!item.videoPath || item.videoPath.trim().length === 0) {
      throw new ChannelManagerValidationException(`QueueItem "${item.id}" must have a non-empty videoPath.`);
    }
    if (!Object.values(PlatformProvider).includes(item.provider)) {
      throw new ChannelManagerValidationException(`QueueItem "${item.id}" has invalid provider "${item.provider}".`);
    }
    if (item.retryCount < 0) {
      throw new ChannelManagerValidationException(`QueueItem "${item.id}" retryCount cannot be negative.`);
    }
    if (item.maxRetries > 10) {
      throw new ChannelManagerValidationException(`QueueItem "${item.id}" maxRetries cannot exceed 10.`);
    }
    if (item.scheduledAt && item.scheduledAt <= new Date()) {
      throw new ChannelManagerValidationException(
        `QueueItem "${item.id}" scheduledAt must be a future date.`
      );
    }
  }

  // ─── Scheduled Post Validation ────────────────────────────────────────────────

  public static validateScheduledPost(post: ScheduledPost): void {
    if (!post.id || post.id.trim().length === 0) {
      throw new ChannelManagerValidationException("ScheduledPost must have a non-empty ID.");
    }
    if (!post.channelId || post.channelId.trim().length === 0) {
      throw new ChannelManagerValidationException(`ScheduledPost "${post.id}" must have a non-empty channelId.`);
    }
    if (!post.scheduledAt || !(post.scheduledAt instanceof Date)) {
      throw new ChannelManagerValidationException(`ScheduledPost "${post.id}" must have a valid scheduledAt Date.`);
    }
    if (post.scheduledAt <= new Date()) {
      throw new ChannelManagerValidationException(
        `ScheduledPost "${post.id}" scheduledAt must be a future date.`
      );
    }
    if (post.timezone && !VALID_TIMEZONES.has(post.timezone)) {
      throw new ChannelManagerValidationException(
        `ScheduledPost "${post.id}" has invalid timezone "${post.timezone}".`
      );
    }
    if (!Object.values(PlatformProvider).includes(post.provider)) {
      throw new ChannelManagerValidationException(`ScheduledPost "${post.id}" has invalid provider "${post.provider}".`);
    }
  }

  // ─── Duplicate Channel IDs ────────────────────────────────────────────────────

  public static validateNoDuplicateChannels(channelIds: string[]): void {
    const seen = new Set<string>();
    for (const id of channelIds) {
      if (seen.has(id)) throw new DuplicateChannelException(id);
      seen.add(id);
    }
  }

  // ─── State Transition Validation ─────────────────────────────────────────────

  private static readonly VALID_TRANSITIONS: Record<ChannelManagerState, ChannelManagerState[]> = {
    [ChannelManagerState.CREATED]:      [ChannelManagerState.INITIALIZED],
    [ChannelManagerState.INITIALIZED]:  [ChannelManagerState.CONNECTING, ChannelManagerState.READY, ChannelManagerState.FAILED],
    [ChannelManagerState.CONNECTING]:   [ChannelManagerState.CONNECTED, ChannelManagerState.FAILED, ChannelManagerState.DISCONNECTED],
    [ChannelManagerState.CONNECTED]:    [ChannelManagerState.SYNCING, ChannelManagerState.READY, ChannelManagerState.DISCONNECTED],
    [ChannelManagerState.SYNCING]:      [ChannelManagerState.READY, ChannelManagerState.FAILED],
    [ChannelManagerState.READY]:        [ChannelManagerState.RUNNING, ChannelManagerState.SYNCING, ChannelManagerState.CONNECTING, ChannelManagerState.PAUSED, ChannelManagerState.DISCONNECTED],
    [ChannelManagerState.RUNNING]:      [ChannelManagerState.READY, ChannelManagerState.PAUSED, ChannelManagerState.FAILED],
    [ChannelManagerState.PAUSED]:       [ChannelManagerState.RUNNING, ChannelManagerState.READY, ChannelManagerState.DISCONNECTED],
    [ChannelManagerState.FAILED]:       [ChannelManagerState.INITIALIZED, ChannelManagerState.CONNECTING],
    [ChannelManagerState.DISCONNECTED]: [ChannelManagerState.CONNECTING, ChannelManagerState.INITIALIZED],
  };

  public static validateStateTransition(jobId: string, from: ChannelManagerState, to: ChannelManagerState): void {
    const allowed = this.VALID_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      throw new ChannelManagerValidationException(
        `Invalid state transition for "${jobId}": "${from}" → "${to}". ` +
        `Allowed: [${allowed.join(", ")}].`
      );
    }
  }
}
