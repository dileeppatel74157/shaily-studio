import { SocialPlatformState } from "./SocialPlatformState";
import { PlatformType } from "./PlatformType";
import { VisibilityType } from "./VisibilityType";
import {
  SocialPost,
  PublishRequest,
  PublishResponse,
  PlatformAccount,
  PlatformAdapter,
  Caption,
  HashtagCollection,
  MentionCollection,
  PublishHistory,
  PlatformStatistics,
  PublishSnapshot,
  SocialEngineStatistics
} from "./models";

export interface ISocialPlatformEngine {
  getState(): SocialPlatformState;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  publishContent(request: PublishRequest): Promise<PublishResponse>;
  getSnapshot(): PublishSnapshot;
  getStatistics(): SocialEngineStatistics;

  // Managers
  getPlatformManager(): IPlatformManager;
  getPublishManager(): IPublishManager;
  getMetadataManager(): IMetadataManager;
  getMediaValidator(): IMediaValidator;
  getScheduler(): IScheduler;
  getRetryManager(): IRetryManager;
  getAnalyticsManager(): IAnalyticsManager;
  getAdapterManager(): IAdapterManager;
  getHistoryManager(): IHistoryManager;
  getAccountManager(): IAccountManager;

  // Events
  on(event: string, handler: (payload: any) => void): void;
  off(event: string, handler: (payload: any) => void): void;
}

export interface IPlatformManager {
  registerPlatform(platform: PlatformType, name: string): Promise<void>;
  getSupportedPlatforms(): PlatformType[];
}

export interface IPublishManager {
  startPublish(request: PublishRequest): Promise<PublishResponse>;
  cancelPublish(requestId: string): Promise<void>;
  getPost(requestId: string): SocialPost | undefined;
}

export interface IMetadataManager {
  adaptMetadata(post: SocialPost, platform: PlatformType): Promise<{ caption: Caption; hashtags: HashtagCollection; mentions: MentionCollection }>;
}

export interface IMediaValidator {
  validateMedia(media: any, platform: PlatformType): Promise<boolean>;
}

export interface IScheduler {
  schedulePublish(post: SocialPost, publishTime: Date): Promise<SocialPost>;
}

export interface IRetryManager {
  handleRetry(post: SocialPost, platform: PlatformType, error: string): Promise<boolean>;
}

export interface IAnalyticsManager {
  initializeAnalytics(post: SocialPost, platform: PlatformType, baseline: any): Promise<PlatformStatistics>;
  getAnalytics(postId: string, platform: PlatformType): Promise<PlatformStatistics>;
}

export interface IAdapterManager {
  registerAdapter(adapter: PlatformAdapter): void;
  getAdapter(platform: PlatformType): PlatformAdapter | undefined;
  listAdapters(): PlatformAdapter[];
}

export interface IHistoryManager {
  logPublish(history: PublishHistory): Promise<void>;
  getHistory(postId: string): Promise<PublishHistory[]>;
}

export interface IAccountManager {
  connectAccount(account: PlatformAccount): Promise<void>;
  disconnectAccount(accountId: string): Promise<void>;
  getConnectedAccounts(): PlatformAccount[];
  isAccountConnected(platform: PlatformType): boolean;
}
