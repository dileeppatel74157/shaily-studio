import { AgentMetadata } from "@shaily/shared";

export const SYSTEM_VERSION = "1.0.0";

export const DEFAULT_AGENTS: AgentMetadata[] = [
  {
    id: "agent-ideator",
    name: "Topic Ideator",
    role: "Content Ideation",
    description: "Generates high-engagement content ideas and angles based on trending topics.",
    version: "1.0.0",
    capabilities: ["trend-analysis", "headline-generation"],
  },
  {
    id: "agent-writer",
    name: "Script Writer",
    role: "Scripting and Copywriting",
    description: "Turns ideas into full video scripts optimized for visual storytelling.",
    version: "1.0.0",
    capabilities: ["script-writing", "pacing-optimization"],
  },
  {
    id: "agent-editor",
    name: "Video Orchestrator",
    role: "Video Editing Coordinator",
    description: "Coordinates raw video assets and stitches them into final sequences.",
    version: "1.0.0",
    capabilities: ["timeline-generation", "asset-indexing"],
  },
];

export function logSystemEvent(event: string, details: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  // Simple structured log format for log parsers
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ timestamp, event, details }));
}

export * from "./kernel/index";
export { DependencyGraph } from "./kernel/index";
export * from "./logger/index";
export * from "./config/index";
export * from "./registry/index";
export * from "./events/index";
export * from "./jobs/index";
export * from "./memory/index";
export * from "./agents/index";
export * from "./planning/index";
export * from "./collaboration/index";
export * from "./workflow/index";
export * from "./router/index";
export * from "./orchestrator/index";
export * from "./plugins/index";
export * from "./tools/index";
export * from "./skills/index";
export * from "./decision/index";
export * from "./research/index";
export * from "./strategy/index";
export * from "./channel/index";
export * from "./script/index";
export * from "./assets/index";
export * from "./production/index";
export * from "./generation/index";
export * from "./video-composition/index";
export * from "./rendering/index";
export * from "./quality/index";
export * from "./publishing/index";
export * from "./analytics/index";
export * from "./channel-manager/index";
export * from "./founder/index";
export * from "./control-center/index";
export * from "./learning/index";
export * from "./optimization/index";
export * from "./pipeline/index";
export * from "./production-ready/index";

export * from "./supervisor/index";
export * from "./prompts/index";
export * from "./knowledge/index";
export * from "./rag/index";
export * from "./mcp/index";
export * from "./messagebus/index";
export * from "./observability/index";
export * from "./security/index";
export * from "./configuration/index";
export * from "./scheduler/index";
export * from "./storage/index";
export * from "./bootstrap/index";
export * from "./host/index";
export {
  RuntimeState,
  EngineState,
  ServiceType,
  RuntimeEventType,
  StartupPriority,
  HeartbeatStatus,
  RuntimeRequest,
  RuntimeResponse,
  RuntimeConfiguration,
  RuntimeSnapshot,
  RuntimeReport,
  RuntimeMetrics,
  RuntimeHealth,
  EngineRegistration,
  EngineDescriptor,
  EngineDependency,
  ServiceRegistration,
  Heartbeat,
  HeartbeatHistory,
  HealthCheck,
  StartupSequence,
  SchedulerJob,
  SchedulerTask,
  SchedulerReport,
  RuntimeStatistics,
  RuntimeEvent,
  RuntimeStateSnapshot,
  IRuntimeEngine,
  IHealthMonitor,
  IHeartbeatManager,
  IStartupManager,
  IShutdownManager,
  IEngineLoader,
  IEngineResolver,
  IRuntimeReporter,
  RuntimeException,
  EngineNotFoundException,
  DependencyException,
  HealthCheckException,
  StartupException,
  ShutdownException,
  RuntimeValidator,
  RuntimeEngine,
  RuntimeBuilder,
  IRuntime,
  Runtime,
  RuntimeContext,
  RuntimeEnvironment,
  RuntimeManifest,
  RuntimeLifecycle,
  RuntimeSession,
  RuntimeSessionDescriptor,
  RuntimeSessionRegistry,
  RuntimeCapability
} from "./runtime/index";
export * from "./gateway/index";
export * from "./studio/index";
export {
  CompositionRoot,
  CompositionBuilder,
  CompositionContext,
  CompositionValidator,
  CompositionSnapshot,
  DependencyContainer,
  IServiceProvider,
  IServiceCollection,
  CompositionException,
  CompositionValidationException,
  InvalidCompositionStateException
} from "./composition/index";
export {
  IPlatform,
  Platform,
  PlatformBuilder,
  PlatformState,
  PlatformValidator,
  PlatformException,
  PlatformValidationException,
  InvalidPlatformStateException
} from "./platform/index";
export {
  IReadiness,
  Readiness,
  ReadinessBuilder,
  ReadinessState,
  ReadinessStatus,
  ReadinessReportStatus,
  ReadinessValidator,
  ReadinessException,
  ReadinessValidationException,
  InvalidReadinessStateException
} from "./readiness/index";
export {
  IProvider,
  Provider,
  ProviderBuilder,
  ProviderRegistry,
  IProviderRegistry,
  ProviderState,
  ProviderType,
  ProviderFeature,
  ProviderCapabilities,
  ProviderMessage,
  ProviderRegistrySnapshot,
  ProviderValidator,
  ProviderException,
  ProviderValidationException,
  InvalidProviderStateException,
  ProviderRequest,
  ProviderResponse,
  ProviderResponseChunk,
  ProviderContext,
  ProviderConfiguration,
  ProviderMetadata,
  IProviderTransport,
  TransportBuilder,
  TransportError,
  TransportRequest,
  TransportResponse
} from "./providers/index";
export * from "./ai/index";
export * from "./conversation/index";
export * from "./prompts/index";

export * as workflows from "./workflows/index";

export {
  WorkspaceState,
  ProjectState,
  AssetCategory,
  AssetStatus,
  VersionState,
  BackupState,
  SearchType,
  StorageProvider,
  Workspace,
  WorkspaceRequest,
  WorkspaceResponse,
  WorkspaceConfiguration,
  WorkspaceProfile,
  Project,
  ProjectMetadata,
  ProjectFolder,
  ProjectStatistics,
  AssetRecord,
  AssetReference,
  AssetDependency,
  AssetCollection,
  ProjectVersion,
  AssetVersion,
  VersionHistory,
  SearchQuery,
  SearchResult,
  SearchIndex,
  BackupJob,
  BackupSnapshot,
  RestoreRequest,
  WorkspaceReport,
  WorkspaceSnapshot,
  IWorkspaceEngine,
  IWorkspaceManager,
  IProjectManager,
  IAssetLibrary,
  IVersionManager,
  ISearchEngine,
  IBackupManager,
  IRestoreManager,
  ILocalDatabase,
  IWorkspaceReporter,
  WorkspaceException,
  ProjectNotFoundException,
  AssetNotFoundException,
  VersionException,
  BackupException,
  RestoreException,
  WorkspaceValidationException,
  InvalidWorkspaceStateException,
  WorkspaceEngine,
  WorkspaceBuilder,
  WorkspaceValidator
} from "./workspace/index";

export {
  AssistantState,
  IntentType,
  CommandType,
  EntityType,
  ResponseType,
  PlannerState,
  ConversationState as AssistantConversationState,
  ConfidenceLevel,
  Conversation as AssistantConversation,
  ConversationMessage as AssistantConversationMessage,
  ConversationHistory as AssistantConversationHistory,
  ConversationContext,
  Intent,
  ParsedIntent,
  Entity,
  Slot,
  Parameter,
  ExecutionPlan,
  ExecutionStep,
  PlannerReport,
  PlannerSnapshot,
  Assistant,
  AssistantRequest,
  AssistantResponse,
  AssistantSession,
  AssistantStatistics,
  ConversationMemory,
  PromptContext,
  UserPreferences,
  ExecutionResult,
  AssistantReport,
  AssistantSnapshot,
  AssistantStateSnapshot,
  IAssistantEngine,
  IIntentParser,
  IEntityExtractor,
  ISlotFiller,
  ICommandPlanner,
  IConversationManager,
  IResponseGenerator,
  IContextResolver,
  ISessionManager,
  IAssistantReporter,
  AssistantException,
  IntentParserException,
  PlannerException,
  SessionNotFoundException,
  AssistantValidationException,
  InvalidAssistantStateException,
  AssistantEngine,
  AssistantBuilder,
  AssistantValidator
} from "./assistant/index";

export {
  SchedulerState as TaskSchedulerState,
  TaskState,
  TaskPriority,
  TriggerType,
  ScheduleType,
  RetryPolicy as TaskRetryPolicy,
  DependencyState,
  ExecutionWindow,
  Scheduler,
  SchedulerRequest,
  SchedulerResponse,
  SchedulerConfiguration,
  SchedulerStatistics,
  SchedulerSnapshot,
  ScheduledTask,
  TaskExecution,
  TaskQueue,
  QueueItem,
  TaskHistory,
  ScheduleRule,
  CronSchedule,
  IntervalSchedule,
  TimeWindow,
  TaskDependency,
  DependencyGraph as TaskSchedulerDependencyGraph,
  DependencyResult,
  RetryPolicyConfig,
  RetryHistory,
  SchedulerMetrics,
  SchedulerReport as TaskSchedulerReport,
  SchedulerEvent,
  ExecutionTimeline,
  SchedulerHealth,
  ITaskSchedulerEngine,
  ISchedulerEngine,
  ITaskManager,
  IScheduleManager,
  IQueueManager,
  ITriggerManager,
  IDependencyManager,
  IRetryManager,
  ICronManager,
  IExecutionManager,
  IResumeManager,
  IMonitoringManager,
  ISchedulerMonitor,
  ISchedulerReporter,
  TaskSchedulerException,
  TaskNotFoundException,
  TriggerException,
  CronParseException,
  TaskSchedulerValidationException,
  InvalidTaskSchedulerStateException,
  TaskSchedulerEngine,
  TaskSchedulerBuilder,
  TaskSchedulerValidator
} from "./task-scheduler/index";

export {
  KnowledgeBaseState,
  KnowledgeNodeType,
  RelationshipType,
  EmbeddingProvider,
  IndexStatus,
  DocumentType,
  RetrievalStrategy,
  KnowledgeSource,
  KnowledgeNode,
  KnowledgeRelationship,
  KnowledgeGraph,
  StoreKnowledgeRequest,
  StoreKnowledgeResponse,
  RetrievalQuery,
  RetrievalResult,
  RetrievalResponse,
  KnowledgeDocument,
  PromptRecord,
  ConversationRecord,
  DecisionRecord,
  ProviderRecord,
  KnowledgeBaseConfiguration,
  KnowledgeBaseStatistics,
  KnowledgeBaseHealth,
  KnowledgeBaseSnapshot,
  KnowledgeBaseReport,
  VectorEntry,
  IKnowledgeBaseEngine,
  IVectorManager,
  IGraphManager,
  IIndexManager,
  IRetrievalManager,
  IDocumentManager,
  IPromptHistoryManager,
  IConversationManager,
  IDecisionHistoryManager,
  IProviderHistoryManager,
  IKnowledgeBaseReporter,
  KnowledgeBaseException,
  KnowledgeNodeNotFoundException,
  DuplicateKnowledgeNodeException,
  EmbeddingException,
  GraphException,
  IndexException,
  KnowledgeBaseValidationException,
  InvalidKnowledgeBaseStateException,
  KnowledgeBaseValidator,
  KnowledgeBaseEngine,
  KnowledgeBaseBuilder,
} from "./knowledge-base/index";

















