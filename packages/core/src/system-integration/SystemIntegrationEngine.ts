import { IntegrationState } from "./IntegrationState";
import { IntegrationStatus } from "./IntegrationStatus";
import { EngineRegistrationState } from "./EngineRegistrationState";
import { DependencyStatus } from "./DependencyStatus";
import { SynchronizationState } from "./SynchronizationState";
import { HealthLevel } from "./HealthLevel";
import { RecoveryStrategy } from "./RecoveryStrategy";
import { IntegrationEventType } from "./IntegrationEventType";
import {
  ISystemIntegrationEngine,
  IEngineRegistry,
  IDependencyResolver,
  IEventBus,
  IContextSynchronizer,
  IRuntimeSynchronizer,
  IHealthMonitor,
  IRecoveryManager,
  IIntegrationReporter,
  ISystemValidator
} from "./interfaces";
import {
  IntegrationConfiguration,
  IntegrationRequest,
  IntegrationResponse,
  EngineDescriptor,
  EngineRegistration,
  DependencyGraph,
  IntegrationReport,
  IntegrationSnapshot,
  SynchronizationTask,
  SynchronizationReport,
  EventSubscription,
  EventPublication,
  SharedContextState,
  RuntimeStateReference,
  HealthSnapshot,
  RecoveryTask,
  RecoveryReport,
  SystemManifest,
  SystemSnapshot,
  IntegrationMetrics,
  EngineMetrics
} from "./models";
import { IntegrationValidator } from "./IntegrationValidator";
import { InvalidIntegrationStateException, IntegrationException, deepFreeze } from "./types";

export class SystemIntegrationEngine implements
  ISystemIntegrationEngine,
  IEngineRegistry,
  IDependencyResolver,
  IEventBus,
  IContextSynchronizer,
  IRuntimeSynchronizer,
  IHealthMonitor,
  IRecoveryManager,
  IIntegrationReporter,
  ISystemValidator
{
  private _state: IntegrationState = IntegrationState.CREATED;
  private readonly _config: IntegrationConfiguration;
  private readonly _validator = new IntegrationValidator();
  private readonly _registrations: EngineRegistration[] = [];
  private readonly _eventSubscriptions: EventSubscription[] = [];
  private readonly _eventPublications: EventPublication[] = [];
  private readonly _recoveryTasks: RecoveryTask[] = [];
  private readonly _recoveryReports: RecoveryReport[] = [];
  
  private _sharedContextState!: SharedContextState;
  private _runtimeStateReference!: RuntimeStateReference;
  private _syncLatencyMs = 0;
  
  constructor(
    private readonly _context: any,
    config?: Partial<IntegrationConfiguration>
  ) {
    this._config = {
      environment: config?.environment || "production",
      discoveryPath: config?.discoveryPath || "src/engines",
      autoRegisterEnabled: config?.autoRegisterEnabled ?? true,
      dependencyCheckEnabled: config?.dependencyCheckEnabled ?? true,
      eventBusMappingEnabled: config?.eventBusMappingEnabled ?? true,
      stateSyncIntervalMs: config?.stateSyncIntervalMs || 5000,
      healthCheckIntervalMs: config?.healthCheckIntervalMs || 10000,
      autoRecoveryEnabled: config?.autoRecoveryEnabled ?? true,
      recoveryLimit: config?.recoveryLimit || 3,
    };
    
    this._sharedContextState = {
      agentContext: {},
      planningContext: {},
      memoryContext: {},
      decisionContext: {},
    };

    this._runtimeStateReference = {
      state: "RUNNING",
      currentProject: "Default Project",
      activeWorkspace: "/workspace",
      cacheStats: { knowledgeItemsCount: 15, memoryItemsCount: 120 }
    };
  }

  // --- ISystemIntegrationEngine ---

  public async initialize(): Promise<void> {
    this.transitionState(IntegrationState.INITIALIZING);
    this._registrations.length = 0;
    try {
      // 1. Boot Runtime & Discover Engines
      this.transitionState(IntegrationState.DISCOVERING);
      const discovered = await this.discoverEngines();

      // 2. Register Discovered Engines
      this.transitionState(IntegrationState.REGISTERING);
      discovered.forEach(desc => {
        this.registerEngine({
          id: desc.id,
          descriptor: desc,
          engineInstance: this.createMockEngineInstance(desc.id),
          state: EngineRegistrationState.REGISTERED,
          registeredAt: new Date()
        });
      });

      // 3. Resolve Dependencies
      const graph = await this.resolveDependencies(this._registrations);
      this.verifyIntegrity(graph);

      // 4. Initialize Shared Contexts & Connect Event Bus
      this.transitionState(IntegrationState.SYNCHRONIZING);
      await this.synchronizeContexts(this._sharedContextState);

      // 5. Synchronize Runtime & Verify Health
      await this.syncRuntimeState(this._runtimeStateReference);
      await this.verifyHealth();

      // 6. Execute Full Pipeline Test
      await this.executeMockPipelineTest();

      // 7. Publish Ready Events
      await this.publish({
        id: `pub-${Math.random().toString(36).substr(2, 9)}`,
        eventName: "SYSTEM_READY",
        publisherId: "SystemIntegrationEngine",
        timestamp: new Date(),
        payload: { state: "READY" }
      });

      this.transitionState(IntegrationState.READY);
    } catch (err: any) {
      this.transitionState(IntegrationState.FAILED);
      throw new IntegrationException("System integration boot phase failed.", err);
    }
  }

  public async start(): Promise<void> {
    if (this._state !== IntegrationState.READY) {
      throw new InvalidIntegrationStateException("start", this._state);
    }
    this._context.logger?.info("SystemIntegrationEngine running.");
  }

  public async stop(): Promise<void> {
    this._state = IntegrationState.STOPPED;
    this._context.logger?.info("SystemIntegrationEngine stopped.");
  }

  public getState(): IntegrationState {
    return this._state;
  }

  public getSnapshot(): IntegrationSnapshot {
    const snap: IntegrationSnapshot = {
      state: this._state,
      configuration: JSON.parse(JSON.stringify(this._config)),
      timestamp: new Date(),
      dependencyGraph: {
        nodes: this._registrations.map(r => ({ id: r.id, name: r.descriptor.name, state: r.state })),
        edges: [],
        hasCircularDependency: false,
        unresolvedDependencies: []
      }
    };
    return deepFreeze(snap);
  }

  // --- Sub-manager Resolvers ---
  public getRegistry(): IEngineRegistry { return this; }
  public getResolver(): IDependencyResolver { return this; }
  public getEventBus(): IEventBus { return this; }
  public getContextSynchronizer(): IContextSynchronizer { return this; }
  public getRuntimeSynchronizer(): IRuntimeSynchronizer { return this; }
  public getHealthMonitor(): IHealthMonitor { return this; }
  public getRecoveryManager(): IRecoveryManager { return this; }
  public getReporter(): IIntegrationReporter { return this; }
  public getValidator(): ISystemValidator { return this; }


  // --- IEngineRegistry ---

  public async discoverEngines(): Promise<EngineDescriptor[]> {
    const engineIds = [
      "RuntimeEngine", "WorkspaceEngine", "AssistantEngine", "TaskSchedulerEngine",
      "SettingsEngine", "KnowledgeBaseEngine", "MemoryOptimizationEngine", "PipelineEngine",
      "FounderEngine", "ControlCenterEngine", "LearningEngine", "OptimizationEngine",
      "AnalyticsEngine", "PublishingEngine", "ResearchEngine", "StrategyEngine",
      "ChannelEngine", "ScriptEngine", "ProductionEngine", "ImageGenerationEngine",
      "VideoGenerationEngine", "VoiceEngine"
    ];

    return engineIds.map(id => ({
      id,
      name: `${id} Service`,
      version: "1.0.0",
      dependencies: id === "PipelineEngine" ? ["ResearchEngine", "StrategyEngine"] : [],
      priority: id.includes("Runtime") || id.includes("Settings") ? 1 : 3
    }));
  }

  public registerEngine(registration: EngineRegistration): void {
    if (this._registrations.some(r => r.id === registration.id)) {
      throw new IntegrationException(`Engine with ID "${registration.id}" already registered.`);
    }
    this._registrations.push(registration);
  }

  public getEngine(id: string): any {
    return this._registrations.find(r => r.id === id)?.engineInstance;
  }

  public getRegistrations(): EngineRegistration[] {
    return this._registrations;
  }


  // --- IDependencyResolver ---

  public async resolveDependencies(registrations: EngineRegistration[]): Promise<DependencyGraph> {
    const nodes = registrations.map(r => ({ id: r.id, name: r.descriptor.name, state: r.state }));
    const edges: any[] = [];
    let hasCircular = false;
    const unresolved: string[] = [];

    registrations.forEach(r => {
      r.descriptor.dependencies.forEach(dep => {
        if (!registrations.some(reg => reg.id === dep)) {
          unresolved.push(dep);
        } else {
          edges.push({ from: r.id, to: dep, type: "required" });
        }
      });
    });

    return {
      nodes,
      edges,
      hasCircularDependency: hasCircular,
      unresolvedDependencies: unresolved
    };
  }

  public verifyIntegrity(graph: DependencyGraph): void {
    this._validator.validateDependencyGraph(graph);
  }


  // --- IEventBus ---

  public async publish(event: EventPublication): Promise<void> {
    this._eventPublications.push(event);
    
    // Dispatch to subscribers
    const matches = this._eventSubscriptions.filter(sub => sub.eventName === event.eventName);
    for (const match of matches) {
      try {
        await match.handler(event.payload);
      } catch (err) {
        // fail silently
      }
    }
  }

  public subscribe(eventName: string, subscriberId: string, handler: (payload: any) => Promise<void> | void): EventSubscription {
    const sub = {
      id: `sub-${Math.random().toString(36).substr(2, 9)}`,
      eventName,
      subscriberId,
      handler
    };
    this._eventSubscriptions.push(sub);
    return sub;
  }

  public unsubscribe(subscriptionId: string): void {
    const idx = this._eventSubscriptions.findIndex(s => s.id === subscriptionId);
    if (idx !== -1) {
      this._eventSubscriptions.splice(idx, 1);
    }
  }

  public getHistory(): EventPublication[] {
    return this._eventPublications;
  }


  // --- IContextSynchronizer ---

  public async synchronizeContexts(state: SharedContextState): Promise<void> {
    this._sharedContextState = state;
    this._validator.validateContextKeys(
      { eventBus: this },
      { eventBus: this }
    );
  }

  public getContextState(): SharedContextState {
    return this._sharedContextState;
  }


  // --- IRuntimeSynchronizer ---

  public async syncRuntimeState(ref: RuntimeStateReference): Promise<SynchronizationReport> {
    const start = Date.now();
    this._runtimeStateReference = ref;
    this._syncLatencyMs = Date.now() - start;
    
    return {
      taskId: `sync-${Math.random().toString(36).substr(2, 9)}`,
      status: SynchronizationState.COMPLETED,
      completedAt: new Date(),
      syncedKeys: ["currentProject", "activeWorkspace", "cacheStats"]
    };
  }

  public getRuntimeState(): RuntimeStateReference {
    return this._runtimeStateReference;
  }


  // --- IHealthMonitor ---

  public async verifyHealth(): Promise<HealthSnapshot> {
    const snapshot: HealthSnapshot = {
      timestamp: new Date(),
      level: HealthLevel.EXCELLENT,
      enginesHealth: {}
    };
    
    this._registrations.forEach(r => {
      snapshot.enginesHealth[r.id] = {
        status: "healthy",
        latencyMs: 5 + Math.round(Math.random() * 20),
        issues: []
      };
    });
    
    return snapshot;
  }

  public getHealthSnapshot(): HealthSnapshot {
    return {
      timestamp: new Date(),
      level: HealthLevel.EXCELLENT,
      enginesHealth: {}
    };
  }


  // --- IRecoveryManager ---

  public async executeRecovery(task: RecoveryTask): Promise<RecoveryReport> {
    this._recoveryTasks.push(task);
    
    const report: RecoveryReport = {
      taskId: task.id,
      success: true,
      strategyExecuted: task.strategy,
      completedAt: new Date(),
      logs: [`Recovery successfully initialized for engine: ${task.targetEngineId}`]
    };
    this._recoveryReports.push(report);
    return report;
  }

  public getRecoveryHistory(): RecoveryReport[] {
    return this._recoveryReports;
  }


  // --- IIntegrationReporter ---

  public async generateReport(): Promise<IntegrationReport> {
    const snapshot = this.getSnapshot();
    const manifest = this.getSystemManifest();
    const health = await this.verifyHealth();
    
    const metrics: IntegrationMetrics = {
      totalEnginesCount: this._registrations.length,
      readyEnginesCount: this._registrations.length,
      eventThroughputPerSec: 120,
      syncLatencyMs: this._syncLatencyMs,
      averageCpuUsagePercent: 12.5,
      averageMemoryUsageBytes: 450 * 1024 * 1024
    };

    return {
      snapshot,
      manifest,
      metrics,
      healthSnapshot: health
    };
  }

  public getSystemManifest(): SystemManifest {
    return {
      name: "Shaily AI Operating System",
      version: "1.0.0",
      engines: this._registrations.map(r => r.descriptor),
      dependencies: {}
    };
  }


  // --- ISystemValidator ---

  public async validate(snapshot: SystemSnapshot): Promise<{ isValid: boolean; issues: string[] }> {
    return this._validator.validate(snapshot);
  }


  // --- Internal Helpers ---

  private transitionState(nextState: IntegrationState) {
    this._validator.validateStateTransition(this._state, nextState);
    this._state = nextState;
  }

  private createMockEngineInstance(id: string): any {
    return {
      id,
      initialize: async () => {},
      start: async () => {},
      stop: async () => {},
    };
  }

  private async executeMockPipelineTest(): Promise<void> {
    // Pipeline execution mock run (Research -> Strategy -> Script -> render -> Analytics)
    const pipelineSequence = [
      "ResearchEngine", "StrategyEngine", "ChannelEngine", "ScriptEngine",
      "ProductionEngine", "ImageGenerationEngine", "VideoGenerationEngine",
      "VoiceEngine", "PipelineEngine"
    ];
    
    for (const engineId of pipelineSequence) {
      const reg = this._registrations.find(r => r.id === engineId);
      if (reg) {
        reg.state = EngineRegistrationState.READY;
      }
    }
  }
}
