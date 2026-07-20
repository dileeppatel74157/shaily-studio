// ─── Enums ────────────────────────────────────────────────────────────────────
export { SocialPlatformState } from "./SocialPlatformState";
export { PlatformType } from "./PlatformType";
export { PublishState } from "./PublishState";
export { ContentType } from "./ContentType";
export { VisibilityType } from "./VisibilityType";
export { AdapterState } from "./AdapterState";
export { SocialEventType } from "./SocialEventType";
export { SocialValidationResult } from "./SocialValidationResult";

// ─── Models ───────────────────────────────────────────────────────────────────
export type {
  SocialPost,
  PublishRequest,
  PublishResponse,
  PlatformAccount,
  PlatformAdapter,
  MediaAssetReference,
  Caption,
  HashtagCollection,
  MentionCollection,
  PublishHistory,
  PublishProgress,
  ScheduleRequest,
  PlatformStatistics,
  AnalyticsSeed,
  RetryAttempt,
  PublishSnapshot,
  SocialEngineStatistics,
  SocialValidationIssue,
  SocialValidationReport
} from "./models";

// ─── Interfaces ───────────────────────────────────────────────────────────────
export type {
  ISocialPlatformEngine,
  IPlatformManager,
  IPublishManager,
  IMetadataManager,
  IMediaValidator,
  IScheduler,
  IRetryManager,
  IAnalyticsManager,
  IAdapterManager,
  IHistoryManager,
  IAccountManager
} from "./interfaces";

// ─── Exceptions & Utilities ───────────────────────────────────────────────────
export {
  SocialPlatformException,
  PlatformConnectionException,
  PublishingException,
  MediaValidationException,
  SchedulingException,
  AnalyticsException,
  ValidationException,
  deepFreeze
} from "./types";

// ─── Engine, Builder, Validator ───────────────────────────────────────────────
export { SocialPlatformEngine } from "./SocialPlatformEngine";
export { SocialPlatformBuilder } from "./SocialPlatformBuilder";
export { SocialPlatformValidator } from "./SocialPlatformValidator";
