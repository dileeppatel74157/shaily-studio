import { IntegrationState } from "./IntegrationState";
import { IntegrationStatus } from "./IntegrationStatus";
import { EngineRegistrationState } from "./EngineRegistrationState";
import { DependencyStatus } from "./DependencyStatus";
import { SynchronizationState } from "./SynchronizationState";
import { HealthLevel } from "./HealthLevel";
import { RecoveryStrategy } from "./RecoveryStrategy";
import { IntegrationEventType } from "./IntegrationEventType";

// 1. IntegrationConfiguration
export interface IntegrationConfiguration {
  environment: string;
  discoveryPath: string;
  autoRegisterEnabled: boolean;
  dependencyCheckEnabled: boolean;
  eventBusMappingEnabled: boolean;
  stateSyncIntervalMs: number;
  healthCheckIntervalMs: number;
  autoRecoveryEnabled: boolean;
  recoveryLimit: number;
}

// 2. IntegrationRequest
export interface IntegrationRequest {
  targetEngineId?: string;
  forceReset: boolean;
  validationLevel: "strict" | "loose";
}

// 3. IntegrationResponse
export interface IntegrationResponse {
  success: boolean;
  message: string;
  timestamp: Date;
  status: IntegrationStatus;
}

// 4. DependencyNode
export interface DependencyNode {
  id: string;
  name: string;
  state: EngineRegistrationState;
}

// 5. DependencyEdge
export interface DependencyEdge {
  from: string;
  to: string;
  type: "required" | "optional";
}

// 6. DependencyGraph
export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  hasCircularDependency: boolean;
  unresolvedDependencies: string[];
}

// 7. EngineDescriptor
export interface EngineDescriptor {
  id: string;
  name: string;
  version: string;
  dependencies: string[];
  priority: number;
}

// 8. EngineRegistration
export interface EngineRegistration {
  id: string;
  descriptor: EngineDescriptor;
  engineInstance: any;
  state: EngineRegistrationState;
  registeredAt: Date;
}

// 9. EngineMetrics
export interface EngineMetrics {
  uptimeMs: number;
  memoryUsageBytes: number;
  averageLatencyMs: number;
  eventCount: number;
}

// 10. IntegrationMetrics
export interface IntegrationMetrics {
  totalEnginesCount: number;
  readyEnginesCount: number;
  eventThroughputPerSec: number;
  syncLatencyMs: number;
  averageCpuUsagePercent: number;
  averageMemoryUsageBytes: number;
}

// 11. EventSubscription
export interface EventSubscription {
  id: string;
  eventName: string;
  subscriberId: string;
  handler: (payload: any) => Promise<void> | void;
}

// 12. EventPublication
export interface EventPublication {
  id: string;
  eventName: string;
  publisherId: string;
  timestamp: Date;
  payload: any;
}

// 13. EventHistory
export interface EventHistory {
  events: EventPublication[];
  limit: number;
}

// 14. SharedContextState
export interface SharedContextState {
  agentContext: Record<string, any>;
  planningContext: Record<string, any>;
  memoryContext: Record<string, any>;
  decisionContext: Record<string, any>;
}

// 15. RuntimeStateReference
export interface RuntimeStateReference {
  state: string;
  currentProject: string;
  activeWorkspace: string;
  activePipelineId?: string;
  activeSessionId?: string;
  cacheStats: {
    knowledgeItemsCount: number;
    memoryItemsCount: number;
  };
}

// 16. HealthSnapshot
export interface HealthSnapshot {
  timestamp: Date;
  level: HealthLevel;
  enginesHealth: Record<string, {
    status: "healthy" | "degraded" | "failed";
    latencyMs: number;
    issues: string[];
  }>;
}

// 17. RecoveryTask
export interface RecoveryTask {
  id: string;
  targetEngineId: string;
  strategy: RecoveryStrategy;
  attempts: number;
  startedAt: Date;
}

// 18. RecoveryReport
export interface RecoveryReport {
  taskId: string;
  success: boolean;
  strategyExecuted: RecoveryStrategy;
  completedAt: Date;
  logs: string[];
}

// 19. SynchronizationTask
export interface SynchronizationTask {
  id: string;
  scope: string;
  state: SynchronizationState;
  startedAt: Date;
}

// 20. SynchronizationReport
export interface SynchronizationReport {
  taskId: string;
  status: SynchronizationState;
  completedAt: Date;
  syncedKeys: string[];
}

// 21. IntegrationEvent
export interface IntegrationEvent {
  id: string;
  type: IntegrationEventType;
  timestamp: Date;
  payload: any;
}

// 22. SystemManifest
export interface SystemManifest {
  name: string;
  version: string;
  engines: EngineDescriptor[];
  dependencies: Record<string, string[]>;
}

// 23. SystemSnapshot
export interface SystemSnapshot {
  integrationState: IntegrationState;
  healthLevel: HealthLevel;
  activeConfiguration: IntegrationConfiguration;
  registrations: Array<{ id: string; state: EngineRegistrationState }>;
}

// 24. IntegrationSnapshot
export interface IntegrationSnapshot {
  state: IntegrationState;
  configuration: IntegrationConfiguration;
  timestamp: Date;
  dependencyGraph: DependencyGraph;
}

// 25. IntegrationReport
export interface IntegrationReport {
  snapshot: IntegrationSnapshot;
  manifest: SystemManifest;
  metrics: IntegrationMetrics;
  healthSnapshot: HealthSnapshot;
}
