// ─── Enums ────────────────────────────────────────────────────────────────────
export { ChannelManagerState } from "./ChannelManagerState";
export { PlatformProvider }    from "./PlatformProvider";
export { AccountStatus }       from "./AccountStatus";
export { UploadQueueState }    from "./UploadQueueState";
export { ScheduleStatus }      from "./ScheduleStatus";
export { CapabilityType }      from "./CapabilityType";
export { SyncStatus }          from "./SyncStatus";

// ─── Models ───────────────────────────────────────────────────────────────────
export type {
  ChannelManagerRequest,
  ChannelManagerResponse,
  ConnectedChannel,
  ChannelProfile,
  PlatformAccount,
  OAuthToken,
  RefreshToken,
  PlatformCapabilities,
  ProviderRateLimit,
  UploadQueue,
  QueueItem,
  ScheduledPost,
  RecurringSchedule,
  PublishingHistory,
  HistoryEntry,
  DraftVideo,
  Playlist,
  Category,
  ChannelStatisticsReference,
  ChannelSnapshot,
  ChannelReport,
  SyncJob,
  SyncResult,
  ChannelMetrics,
  ChannelHealth,
} from "./models";

// ─── Interfaces ───────────────────────────────────────────────────────────────
export type {
  IChannelManager,
  IChannelProvider,
  IAccountManager,
  IOAuthManager,
  ISynchronizer,
  IUploadQueueManager,
  IScheduleManager,
  ICapabilityResolver,
  IChannelMonitor,
  IHistoryManager,
} from "./interfaces";

// ─── Engine ───────────────────────────────────────────────────────────────────
export { ChannelManagerEngine }    from "./ChannelManagerEngine";
export { ChannelManagerBuilder }   from "./ChannelManagerBuilder";
export { ChannelManagerValidator } from "./ChannelManagerValidator";

// ─── Exception Types ──────────────────────────────────────────────────────────
export {
  ChannelManagerException,
  ChannelManagerValidationException,
  DuplicateChannelException,
  DuplicateProviderException,
  ChannelNotFoundException,
  OAuthException,
  TokenExpiredException,
  ProviderNotFoundException,
  CapabilityMismatchException,
  QueueConflictException,
  ScheduleConflictException,
  InvalidChannelStateException,
} from "./types";
