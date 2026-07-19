import { IRuntimeEngine, IServiceRegistry, IHealthMonitor, IHeartbeatManager, IStartupManager, IShutdownManager, IScheduler, IRuntimeReporter } from "./interfaces";
import { RuntimeState } from "./RuntimeState";
import { EngineState } from "./EngineState";
import { ServiceType } from "./ServiceType";
import { RuntimeValidator } from "./RuntimeValidator";
import { WorkspaceBuilder } from "../workspace/WorkspaceBuilder";
import { AssistantBuilder } from "../assistant/AssistantBuilder";
import { RuntimeSession } from "./RuntimeSession";
import { RuntimeSessionDescriptor } from "./RuntimeSessionDescriptor";
import { HealthStatus } from "./HealthStatus";
import { RuntimeEventType } from "./RuntimeEventType";
import { StartupPriority } from "./StartupPriority";
import { SchedulerState } from "./SchedulerState";
import { HeartbeatStatus } from "./HeartbeatStatus";
import {
  RuntimeRequest,
  RuntimeResponse,
  RuntimeConfiguration,
  RuntimeSnapshot,
  RuntimeReport,
  RuntimeMetrics,
  RuntimeHealth,
  EngineRegistration,
  EngineDescriptor,
  ServiceRegistration,
  ServiceDescriptor,
  Heartbeat,
  HeartbeatHistory,
  HealthCheck,
  HealthReport,
  StartupSequence,
  ShutdownSequence,
  SchedulerJob,
  SchedulerTask,
  SchedulerReport,
  RuntimeStatistics,
  RuntimeEvent,
  RuntimeStateSnapshot
} from "./models";
import {
  RuntimeException,
  EngineNotFoundException,
  DependencyException,
  HealthCheckException,
  StartupException,
  ShutdownException,
  SchedulerException,
  RuntimeValidationException,
  InvalidRuntimeStateException,
  deepFreeze
} from "./types";


export class RuntimeEngine implements IRuntimeEngine {
  private _state = RuntimeState.CREATED;
  private readonly _engines = new Map<string, EngineRegistration>();
  private readonly _engineStates = new Map<string, EngineState>();
  private readonly _engineHealths = new Map<string, HealthStatus>();
  
  // Backward compatibility sessions
  private readonly _sessions = new Map<string, RuntimeSession>();

  // Event handlers
  private readonly _eventHandlers = new Map<RuntimeEventType, Set<(event: RuntimeEvent) => void>>();

  // Metrics tracking
  private _bootStartTime = 0;
  private _startupTimeMs = 0;
  private _shutdownTimeMs = 0;
  private _tokenUsage = 0;
  private readonly _providerLatencyMs: Record<string, number> = {};

  // Sub-components
  private readonly _registry: ServiceRegistryImpl;
  private readonly _healthMonitor: HealthMonitorImpl;
  private readonly _heartbeatManager: HeartbeatManagerImpl;
  private readonly _startupManager: StartupManagerImpl;
  private readonly _shutdownManager: ShutdownManagerImpl;
  private readonly _scheduler: SchedulerImpl;
  private readonly _reporter: RuntimeReporterImpl;

  constructor(
    private readonly _context: any,
    private readonly _config: RuntimeConfiguration
  ) {
    RuntimeValidator.validateContext(_context);
    RuntimeValidator.validateRuntimeConfig(_config);

    this._registry = new ServiceRegistryImpl(this);
    this._healthMonitor = new HealthMonitorImpl(this);
    this._heartbeatManager = new HeartbeatManagerImpl(this);
    this._startupManager = new StartupManagerImpl(this);
    this._shutdownManager = new ShutdownManagerImpl(this);
    this._scheduler = new SchedulerImpl(this);
    this._reporter = new RuntimeReporterImpl(this);

    const workspaceEngine = new WorkspaceBuilder()
      .withContext(_context)
      .build();
    this.registerEngine({
      id: "WorkspaceEngine",
      engine: workspaceEngine,
      dependencies: [],
      priority: StartupPriority.CRITICAL
    });

    const assistantEngine = new AssistantBuilder()
      .withContext(_context)
      .build();
    this.registerEngine({
      id: "AssistantEngine",
      engine: assistantEngine,
      dependencies: [],
      priority: StartupPriority.HIGH
    });
  }

  // --- IRuntimeEngine Implementation ---

  public async initialize(): Promise<void> {
    if (this._state !== RuntimeState.CREATED && this._state !== RuntimeState.STOPPED) {
      throw new InvalidRuntimeStateException("initialize", this._state);
    }
    
    this._bootStartTime = Date.now();
    this._state = RuntimeState.INITIALIZING;
    this.emit(RuntimeEventType.BOOT, { timestamp: new Date() });
    await this.logToMemory("startup", "initialize_start", { timestamp: new Date() });

    try {
      // 1. Discover and load engines (normally dynamically registered, but during init we resolve layout)
      const registrations = Array.from(this._engines.values());
      
      // 2. Validate circular dependencies
      RuntimeValidator.validateCircularDependencies(registrations);
      
      // 3. Resolve topological order
      const order = this._startupManager.determineStartupOrder(this.getEngineDescriptors());
      
      // 4. Initialize engines in order
      for (const engineId of order) {
        const reg = this._engines.get(engineId)!;
        this._engineStates.set(engineId, EngineState.STARTING);
        if (typeof reg.engine.initialize === "function") {
          await reg.engine.initialize();
        }
        this._engineStates.set(engineId, EngineState.INITIALIZED);
      }
      
      await this.logToMemory("startup", "initialize_success", { timestamp: new Date(), order });
    } catch (err: any) {
      this._state = RuntimeState.FAILED;
      this.emit(RuntimeEventType.ERROR, { error: err.message });
      await this.logToMemory("startup", "initialize_failed", { timestamp: new Date(), error: err.message });
      throw new StartupException(`Boot initialization failed: ${err.message}`);
    }
  }

  public async start(): Promise<void> {
    if (this._state !== RuntimeState.INITIALIZING && this._state !== RuntimeState.STOPPED) {
      throw new InvalidRuntimeStateException("start", this._state);
    }

    this._state = RuntimeState.STARTING;
    await this.logToMemory("startup", "start_begin", { timestamp: new Date() });

    try {
      const order = this._startupManager.determineStartupOrder(this.getEngineDescriptors());
      
      // Start engines
      for (const engineId of order) {
        const reg = this._engines.get(engineId)!;
        this._engineStates.set(engineId, EngineState.STARTING);
        if (typeof reg.engine.start === "function") {
          await reg.engine.start();
        }
        this._engineStates.set(engineId, EngineState.RUNNING);
        this._engineHealths.set(engineId, HealthStatus.HEALTHY);
        this.emit(RuntimeEventType.SERVICE_STARTED, { id: engineId, type: ServiceType.ENGINE });
      }

      this._startupTimeMs = Date.now() - this._bootStartTime;

      // Start sub-services
      this._heartbeatManager.startHeartbeat();
      this._scheduler.start();

      this._state = RuntimeState.RUNNING;
      this.emit(RuntimeEventType.READY, { timestamp: new Date() });
      await this.logToMemory("startup", "start_success", { timestamp: new Date(), startupTimeMs: this._startupTimeMs });

      // Decision engine integration: Log fast/slow engines
      if (this._context.decisionEngine && typeof this._context.decisionEngine.recordOutcome === "function") {
        await this._context.decisionEngine.recordOutcome({
          id: `startup-outcome-${Date.now()}`,
          decisionId: "boot-optimization",
          chosenOptionId: "standard-boot",
          score: 1.0,
          metrics: { startupTimeMs: this._startupTimeMs },
          timestamp: new Date()
        });
      }
    } catch (err: any) {
      this._state = RuntimeState.FAILED;
      this.emit(RuntimeEventType.ERROR, { error: err.message });
      await this.logToMemory("startup", "start_failed", { timestamp: new Date(), error: err.message });
      throw new StartupException(`Boot startup failed: ${err.message}`);
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== RuntimeState.RUNNING && this._state !== RuntimeState.PAUSED) {
      throw new InvalidRuntimeStateException("stop", this._state);
    }

    const stopStart = Date.now();
    this._state = RuntimeState.STOPPING;
    this.emit(RuntimeEventType.SHUTDOWN, { timestamp: new Date() });
    await this.logToMemory("shutdown", "stop_begin", { timestamp: new Date() });

    try {
      // 1. Destroy compatibility sessions
      for (const sessionId of this._sessions.keys()) {
        await this.destroySession(sessionId);
      }

      // 2. Stop scheduler & heartbeat
      this._scheduler.stop();
      this._heartbeatManager.stopHeartbeat();

      // 3. Stop engines in reverse topological order
      const order = this._startupManager.determineStartupOrder(this.getEngineDescriptors()).reverse();
      for (const engineId of order) {
        const reg = this._engines.get(engineId)!;
        if (typeof reg.engine.stop === "function") {
          await reg.engine.stop();
        }
        this._engineStates.set(engineId, EngineState.STOPPED);
        this.emit(RuntimeEventType.SERVICE_STOPPED, { id: engineId, type: ServiceType.ENGINE });
      }

      this._shutdownTimeMs = Date.now() - stopStart;
      this._state = RuntimeState.STOPPED;
      await this.logToMemory("shutdown", "stop_success", { timestamp: new Date(), shutdownTimeMs: this._shutdownTimeMs });
    } catch (err: any) {
      this._state = RuntimeState.FAILED;
      this.emit(RuntimeEventType.ERROR, { error: err.message });
      await this.logToMemory("shutdown", "stop_failed", { timestamp: new Date(), error: err.message });
      throw new ShutdownException(`Shutdown failed: ${err.message}`);
    }
  }

  public registerEngine(registration: EngineRegistration): void {
    RuntimeValidator.validateEngineRegistration(registration);
    RuntimeValidator.validateEngineIdUnique(registration.id, this._engines);

    this._engines.set(registration.id, registration);
    this._engineStates.set(registration.id, EngineState.REGISTERED);
    this._engineHealths.set(registration.id, HealthStatus.UNKNOWN);

    // Register with service registry
    this._registry.register(registration.id, ServiceType.ENGINE, registration.engine, registration.metadata);

    this.emit(RuntimeEventType.SERVICE_REGISTERED, { id: registration.id, type: ServiceType.ENGINE });
  }

  public registerService(registration: ServiceRegistration): void {
    RuntimeValidator.validateServiceRegistration(registration);
    
    this._registry.register(registration.id, registration.type, registration.service, registration.metadata);
    this.emit(RuntimeEventType.SERVICE_REGISTERED, { id: registration.id, type: registration.type });
  }

  public getEngine<T>(id: string): T {
    const eng = this._engines.get(id);
    if (!eng) {
      throw new EngineNotFoundException(id);
    }
    return eng.engine as T;
  }

  public getService<T>(id: string): T {
    return this._registry.get<T>(id);
  }

  public getSnapshot(): RuntimeSnapshot {
    const snap: RuntimeSnapshot = {
      timestamp: new Date(),
      state: this._state,
      metrics: this._reporter.getMetrics(),
      health: this._healthMonitor.getHealthSummary(),
      engines: this.getEngineDescriptors(),
      services: this._registry.list(),
      scheduler: {
        timestamp: new Date(),
        state: this._scheduler.getSchedulerState(),
        activeJobs: this._scheduler.getJobs()
      },
      metadata: this._config.metadata
    };
    const frozenSnap = deepFreeze(snap);
    RuntimeValidator.validateSnapshotImmutability(frozenSnap);
    return frozenSnap;
  }

  public getState(): RuntimeState {
    return this._state;
  }

  public on(eventType: RuntimeEventType, handler: (event: RuntimeEvent) => void): void {
    if (!this._eventHandlers.has(eventType)) {
      this._eventHandlers.set(eventType, new Set());
    }
    this._eventHandlers.get(eventType)!.add(handler);
  }

  public off(eventType: RuntimeEventType, handler: (event: RuntimeEvent) => void): void {
    if (this._eventHandlers.has(eventType)) {
      this._eventHandlers.get(eventType)!.delete(handler);
    }
  }

  public emit(eventType: RuntimeEventType, payload?: any): void {
    const event: RuntimeEvent = {
      type: eventType,
      timestamp: new Date(),
      payload
    };

    // Trigger handlers
    const handlers = this._eventHandlers.get(eventType);
    if (handlers) {
      for (const h of handlers) {
        try {
          h(event);
        } catch (err) {
          // Suppress handler side-effect failures
        }
      }
    }

    // Write to memory bus
    this.logToMemory("runtime-events", `event-${Date.now()}`, event).catch(() => {});
  }

  public getScheduler(): IScheduler {
    return this._scheduler;
  }

  public getRegistry(): IServiceRegistry {
    return this._registry;
  }

  public getHealthMonitor(): IHealthMonitor {
    return this._healthMonitor;
  }

  public getHeartbeatManager(): IHeartbeatManager {
    return this._heartbeatManager;
  }

  public getStartupManager(): IStartupManager {
    return this._startupManager;
  }

  public getShutdownManager(): IShutdownManager {
    return this._shutdownManager;
  }

  public getReporter(): IRuntimeReporter {
    return this._reporter;
  }

  public getContext(): any {
    return this._context;
  }

  public getConfig(): RuntimeConfiguration {
    return this._config;
  }

  // --- Session Compatibility Methods ---

  public async createSession(descriptor: RuntimeSessionDescriptor): Promise<RuntimeSession> {
    if (this._state !== RuntimeState.RUNNING) {
      throw new InvalidRuntimeStateException("createSession", this._state);
    }
    RuntimeValidator.validateIdentifier(descriptor.id, "Session ID");
    if (this._sessions.has(descriptor.id)) {
      throw new RuntimeValidationException(`Session with ID "${descriptor.id}" already exists`);
    }

    const session: RuntimeSession = {
      id: descriptor.id,
      createdAt: new Date(),
      state: "ACTIVE",
      metadata: descriptor.metadata ? { ...descriptor.metadata } : {}
    };

    this._sessions.set(descriptor.id, session);
    return deepFreeze(session);
  }

  public async destroySession(sessionId: string): Promise<void> {
    if (this._state !== RuntimeState.RUNNING && this._state !== RuntimeState.STOPPING) {
      throw new InvalidRuntimeStateException("destroySession", this._state);
    }
    RuntimeValidator.validateIdentifier(sessionId, "Session ID");
    if (!this._sessions.has(sessionId)) {
      throw new RuntimeValidationException(`Session with ID "${sessionId}" does not exist`);
    }

    const session = this._sessions.get(sessionId)!;
    (session as any).state = "DESTROYED";
    this._sessions.delete(sessionId);
  }

  public hasSession(sessionId: string): boolean {
    if (this._state !== RuntimeState.RUNNING) {
      throw new InvalidRuntimeStateException("hasSession", this._state);
    }
    RuntimeValidator.validateIdentifier(sessionId, "Session ID");
    return this._sessions.has(sessionId);
  }

  public getSession(sessionId: string): RuntimeSession | undefined {
    if (this._state !== RuntimeState.RUNNING) {
      throw new InvalidRuntimeStateException("getSession", this._state);
    }
    RuntimeValidator.validateIdentifier(sessionId, "Session ID");
    const session = this._sessions.get(sessionId);
    return session ? deepFreeze(session) : undefined;
  }

  public listSessions(): readonly RuntimeSession[] {
    if (this._state !== RuntimeState.RUNNING) {
      throw new InvalidRuntimeStateException("listSessions", this._state);
    }
    return deepFreeze(Array.from(this._sessions.values()));
  }

  // --- Helper Methods ---

  public snapshot(): RuntimeSnapshot {
    return this.getSnapshot();
  }

  public getEngineDescriptors(): EngineDescriptor[] {
    const list: EngineDescriptor[] = [];
    for (const [id, reg] of this._engines.entries()) {
      list.push({
        id,
        state: this._engineStates.get(id) || EngineState.REGISTERED,
        dependencies: reg.dependencies,
        priority: reg.priority,
        health: this._engineHealths.get(id) || HealthStatus.UNKNOWN,
        metrics: {
          cpu: 1.2, // mock metric
          memory: 45 * 1024 * 1024, // mock metric
          queueLength: 0,
          latencyMs: 15,
          errorsCount: 0
        }
      });
    }
    return list;
  }

  private async logToMemory(namespace: string, key: string, value: any): Promise<void> {
    if (this._context.memoryStore && typeof this._context.memoryStore.set === "function") {
      try {
        await this._context.memoryStore.set(namespace, key, value);
      } catch (err) {
        // Suppress memory write errors
      }
    }
  }

  public recordTokenUsage(tokens: number): void {
    this._tokenUsage += tokens;
  }

  public recordProviderLatency(provider: string, latency: number): void {
    this._providerLatencyMs[provider] = latency;
  }

  // Setters for tests
  public setEngineState(id: string, state: EngineState): void {
    if (this._engines.has(id)) {
      this._engineStates.set(id, state);
    }
  }

  public setEngineHealth(id: string, health: HealthStatus): void {
    if (this._engines.has(id)) {
      this._engineHealths.set(id, health);
    }
  }
}

// ─── Service Registry Implementation ──────────────────────────────────────────

class ServiceRegistryImpl implements IServiceRegistry {
  public readonly descriptors = new Map<string, ServiceDescriptor>();
  public readonly instances = new Map<string, any>();

  constructor(private readonly runtime: RuntimeEngine) {}

  public register(id: string, type: ServiceType, instance: any, metadata?: Record<string, any>): void {
    RuntimeValidator.validateIdentifier(id, "Service ID");
    if (this.instances.has(id)) {
      throw new RuntimeValidationException(`Service/Engine with ID "${id}" is already registered.`);
    }

    const desc: ServiceDescriptor = {
      id,
      type,
      state: EngineState.REGISTERED,
      metadata
    };

    this.descriptors.set(id, desc);
    this.instances.set(id, instance);
  }

  public unregister(id: string): void {
    RuntimeValidator.validateIdentifier(id, "Service ID");
    if (!this.instances.has(id)) {
      throw new RuntimeValidationException(`Service "${id}" is not registered.`);
    }
    this.descriptors.delete(id);
    this.instances.delete(id);
  }

  public get<T>(id: string): T {
    if (!this.instances.has(id)) {
      throw new RuntimeValidationException(`Service with ID "${id}" was not found.`);
    }
    return this.instances.get(id) as T;
  }

  public has(id: string): boolean {
    return this.instances.has(id);
  }

  public list(): ServiceDescriptor[] {
    return Array.from(this.descriptors.values());
  }
}

// ─── Health Monitor Implementation ────────────────────────────────────────────

class HealthMonitorImpl implements IHealthMonitor {
  private readonly checks: HealthCheck[] = [];

  constructor(private readonly runtime: RuntimeEngine) {}

  public async checkHealth(): Promise<HealthReport> {
    const engines = this.runtime.getEngineDescriptors();
    const checks: HealthCheck[] = [];
    let scoreTotal = 0;

    for (const eng of engines) {
      const status = eng.health;
      let score = 100;
      if (status === HealthStatus.WARNING) score = 70;
      if (status === HealthStatus.UNHEALTHY) score = 30;
      if (status === HealthStatus.OFFLINE) score = 0;

      const hc: HealthCheck = {
        id: `check-${eng.id}-${Date.now()}`,
        targetId: eng.id,
        status,
        score,
        timestamp: new Date()
      };
      RuntimeValidator.validateHealthCheck(hc);
      checks.push(hc);
      scoreTotal += score;
    }

    const score = engines.length > 0 ? Math.round(scoreTotal / engines.length) : 100;
    
    let summaryStatus = HealthStatus.HEALTHY;
    if (score < 50) summaryStatus = HealthStatus.UNHEALTHY;
    else if (score < 85) summaryStatus = HealthStatus.WARNING;

    const report: HealthReport = {
      timestamp: new Date(),
      status: summaryStatus,
      score,
      checks
    };

    this.checks.push(...checks);
    await this.runtime.getContext().memoryStore?.set("runtime-health", "latest_report", report);
    return report;
  }

  public getHealthReport(): HealthReport {
    const engines = this.runtime.getEngineDescriptors();
    const checks = this.checks.slice(-engines.length);
    const score = checks.length > 0 ? Math.round(checks.reduce((acc, c) => acc + c.score, 0) / checks.length) : 100;
    let summaryStatus = HealthStatus.HEALTHY;
    if (score < 50) summaryStatus = HealthStatus.UNHEALTHY;
    else if (score < 85) summaryStatus = HealthStatus.WARNING;

    return {
      timestamp: new Date(),
      status: summaryStatus,
      score,
      checks
    };
  }

  public getHealthSummary(): RuntimeHealth {
    const engines = this.runtime.getEngineDescriptors();
    const enginesMap: Record<string, HealthStatus> = {};
    let scoreTotal = 0;

    for (const eng of engines) {
      enginesMap[eng.id] = eng.health;
      let score = 100;
      if (eng.health === HealthStatus.WARNING) score = 70;
      if (eng.health === HealthStatus.UNHEALTHY) score = 30;
      if (eng.health === HealthStatus.OFFLINE) score = 0;
      scoreTotal += score;
    }

    const score = engines.length > 0 ? Math.round(scoreTotal / engines.length) : 100;
    let summaryStatus = HealthStatus.HEALTHY;
    if (score < 50) summaryStatus = HealthStatus.UNHEALTHY;
    else if (score < 85) summaryStatus = HealthStatus.WARNING;

    return {
      status: summaryStatus,
      score,
      engines: enginesMap,
      lastChecked: new Date()
    };
  }

  public updateHealth(id: string, status: HealthStatus, details?: any): void {
    this.runtime.setEngineHealth(id, status);
    this.runtime.emit(RuntimeEventType.HEALTH_CHANGED, { id, status, details });
  }
}

// ─── Heartbeat Manager Implementation ──────────────────────────────────────────

class HeartbeatManagerImpl implements IHeartbeatManager {
  private intervalId?: NodeJS.Timeout;
  private readonly history = new Map<string, Heartbeat[]>();

  constructor(private readonly runtime: RuntimeEngine) {}

  public startHeartbeat(): void {
    const config = this.runtime.getConfig();
    this.intervalId = setInterval(() => {
      const engines = this.runtime.getEngineDescriptors();
      for (const eng of engines) {
        if (eng.state === EngineState.RUNNING) {
          // If we detect errors or high CPU, we mark as MISSED/TIMEOUT
          let status = HeartbeatStatus.ACTIVE;
          if (eng.metrics && eng.metrics.errorsCount > 5) {
            status = HeartbeatStatus.MISSED;
            this.runtime.emit(RuntimeEventType.HEARTBEAT_TIMEOUT, { id: eng.id, status });
          }
          this.recordHeartbeat(eng.id, status, { cpu: 1.0, memory: 12450 });
        }
      }
    }, config.heartbeatIntervalMs);
  }

  public stopHeartbeat(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  public recordHeartbeat(engineId: string, status: HeartbeatStatus, metrics?: any): void {
    const hb: Heartbeat = {
      timestamp: new Date(),
      engineId,
      status,
      metrics
    };
    RuntimeValidator.validateHeartbeat(hb);
    
    if (!this.history.has(engineId)) {
      this.history.set(engineId, []);
    }
    const hbList = this.history.get(engineId)!;
    hbList.push(hb);
    if (hbList.length > 50) hbList.shift();

    this.runtime.getContext().memoryStore?.set("heartbeat", `hb-${engineId}`, hb).catch(() => {});
  }

  public getHeartbeatHistory(engineId: string): HeartbeatHistory {
    const heartbeats = this.history.get(engineId) || [];
    const missedCount = heartbeats.filter(h => h.status === HeartbeatStatus.MISSED).length;
    const lastHeartbeat = heartbeats[heartbeats.length - 1]?.timestamp;

    return {
      engineId,
      heartbeats,
      missedCount,
      lastHeartbeat
    };
  }
}

// ─── Startup Manager Implementation ───────────────────────────────────────────

class StartupManagerImpl implements IStartupManager {
  constructor(private readonly runtime: RuntimeEngine) {}

  public determineStartupOrder(engines: EngineDescriptor[]): string[] {
    const adj = new Map<string, string[]>();
    const allIds = new Set<string>();

    for (const eng of engines) {
      adj.set(eng.id, eng.dependencies);
      allIds.add(eng.id);
    }

    const visited = new Set<string>();
    const temp = new Set<string>();
    const order: string[] = [];

    const visit = (node: string) => {
      if (temp.has(node)) {
        throw new DependencyException("Circular engine dependency detected in runtime configuration.");
      }
      if (!visited.has(node)) {
        temp.add(node);
        const deps = adj.get(node) || [];
        for (const dep of deps) {
          visit(dep);
        }
        temp.delete(node);
        visited.add(node);
        order.push(node);
      }
    };

    for (const id of allIds) {
      if (!visited.has(id)) {
        visit(id);
      }
    }

    return order;
  }

  public async executeStartup(engines: Map<string, EngineRegistration>): Promise<StartupSequence> {
    const order = this.determineStartupOrder(Array.from(engines.values()).map(r => ({
      id: r.id,
      state: EngineState.REGISTERED,
      dependencies: r.dependencies,
      priority: r.priority,
      health: HealthStatus.UNKNOWN
    })));

    const seq: StartupSequence = {
      startedAt: new Date(),
      order,
      status: "RUNNING"
    };

    try {
      for (const id of order) {
        const reg = engines.get(id)!;
        if (typeof reg.engine.initialize === "function") {
          await reg.engine.initialize();
        }
        if (typeof reg.engine.start === "function") {
          await reg.engine.start();
        }
      }
      seq.completedAt = new Date();
      seq.status = "COMPLETED";
    } catch (err: any) {
      seq.completedAt = new Date();
      seq.status = "FAILED";
      seq.error = err.message;
      throw new StartupException(err.message);
    }

    return seq;
  }
}

// ─── Shutdown Manager Implementation ──────────────────────────────────────────

class ShutdownManagerImpl implements IShutdownManager {
  constructor(private readonly runtime: RuntimeEngine) {}

  public async executeShutdown(engines: Map<string, EngineRegistration>): Promise<ShutdownSequence> {
    const order = this.runtime.getStartupManager().determineStartupOrder(
      Array.from(engines.values()).map(r => ({
        id: r.id,
        state: EngineState.RUNNING,
        dependencies: r.dependencies,
        priority: r.priority,
        health: HealthStatus.HEALTHY
      }))
    ).reverse();

    const seq: ShutdownSequence = {
      startedAt: new Date(),
      order,
      status: "RUNNING"
    };

    try {
      for (const id of order) {
        const reg = engines.get(id)!;
        if (typeof reg.engine.stop === "function") {
          await reg.engine.stop();
        }
      }
      seq.completedAt = new Date();
      seq.status = "COMPLETED";
    } catch (err: any) {
      seq.completedAt = new Date();
      seq.status = "FAILED";
      seq.error = err.message;
      throw new ShutdownException(err.message);
    }

    return seq;
  }
}

// ─── Scheduler Implementation ─────────────────────────────────────────────────

class SchedulerImpl implements IScheduler {
  private _state = SchedulerState.STOPPED;
  private readonly _jobs = new Map<string, SchedulerJob>();
  private readonly _tasks = new Map<string, SchedulerTask>();
  private _intervalId?: NodeJS.Timeout;

  constructor(private readonly runtime: RuntimeEngine) {}

  public scheduleJob(job: SchedulerJob): void {
    RuntimeValidator.validateSchedulerJob(job);
    RuntimeValidator.validateJobIdUnique(job.id, new Set(this._jobs.keys()));

    this._jobs.set(job.id, job);
    this._tasks.set(job.id, {
      id: `task-${job.id}`,
      jobId: job.id,
      state: SchedulerState.IDLE,
      runCount: 0,
      errorCount: 0
    });
  }

  public unscheduleJob(jobId: string): void {
    RuntimeValidator.validateIdentifier(jobId, "Job ID");
    if (!this._jobs.has(jobId)) {
      throw new SchedulerException(`Job "${jobId}" is not scheduled.`);
    }
    this._jobs.delete(jobId);
    this._tasks.delete(jobId);
  }

  public start(): void {
    this._state = SchedulerState.RUNNING;
    this.runtime.emit(RuntimeEventType.SCHEDULER_STARTED, { timestamp: new Date() });

    // Poll to run intervals
    this._intervalId = setInterval(() => {
      this.runtime.emit(RuntimeEventType.SCHEDULER_TICK, { timestamp: new Date() });
      const now = Date.now();
      for (const [id, job] of this._jobs.entries()) {
        const task = this._tasks.get(id)!;
        if (job.intervalMs) {
          const lastRunTime = task.lastRun ? task.lastRun.getTime() : 0;
          if (now - lastRunTime >= job.intervalMs) {
            this.executeTask(job, task).catch(() => {});
          }
        } else if (job.cronExpression) {
          // simple simulation of cron execution every poll
          const lastRunTime = task.lastRun ? task.lastRun.getTime() : 0;
          if (now - lastRunTime >= 5000) { // run every 5s for simulation
            this.executeTask(job, task).catch(() => {});
          }
        }
      }
    }, this.runtime.getConfig().schedulerIntervalMs || 1000);
  }

  public stop(): void {
    this._state = SchedulerState.STOPPED;
    this.runtime.emit(RuntimeEventType.SCHEDULER_STOPPED, { timestamp: new Date() });
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = undefined;
    }
  }

  public getJobs(): SchedulerTask[] {
    return Array.from(this._tasks.values());
  }

  public getSchedulerState(): SchedulerState {
    return this._state;
  }

  private async executeTask(job: SchedulerJob, task: SchedulerTask): Promise<void> {
    task.state = SchedulerState.RUNNING;
    task.lastRun = new Date();
    task.nextRun = new Date(Date.now() + (job.intervalMs || 5000));
    task.runCount++;

    try {
      await job.task(this.runtime.getContext());
      task.state = SchedulerState.IDLE;
    } catch (err) {
      task.state = SchedulerState.STOPPED;
      task.errorCount++;
      throw new SchedulerException(`Job "${job.id}" failed: ${(err as Error).message}`);
    } finally {
      this.runtime.getContext().memoryStore?.set("scheduler", `task-${job.id}`, task).catch(() => {});
    }
  }
}

// ─── Runtime Reporter Implementation ─────────────────────────────────────────

class RuntimeReporterImpl implements IRuntimeReporter {
  constructor(private readonly runtime: RuntimeEngine) {}

  public generateReport(): RuntimeReport {
    const snap = this.runtime.getSnapshot();
    const upTimeS = Math.floor((Date.now() - this.runtime.getContext().startTime || Date.now()) / 1000);

    return {
      timestamp: new Date(),
      runtimeId: "runtime-os-18-1",
      state: this.runtime.getState(),
      uptimeS: upTimeS,
      metrics: this.getMetrics(),
      health: snap.health,
      engines: snap.engines.map(e => ({ id: e.id, state: e.state, health: e.health })),
      scheduler: {
        activeJobsCount: snap.scheduler.activeJobs.length,
        runCount: snap.scheduler.activeJobs.reduce((acc, j) => acc + j.runCount, 0)
      }
    };
  }
  public getMetrics(): RuntimeMetrics {
    const engines = this.runtime.getEngineDescriptors();
    const scheduler = this.runtime.getScheduler();
    const runningJobsCount = scheduler.getJobs().filter(t => t.state === SchedulerState.RUNNING).length;

    return {
      startupTimeMs: (this.runtime as any)._startupTimeMs,
      shutdownTimeMs: (this.runtime as any)._shutdownTimeMs,
      cpuUsagePercent: 3.5, // Aggregate mock CPU
      memoryUsageBytes: 154 * 1024 * 1024, // Aggregate mock RAM
      gpuUsagePercent: 0,
      providerLatencyMs: (this.runtime as any)._providerLatencyMs,
      engineCount: engines.length,
      runningJobs: runningJobsCount,
      tokenUsage: (this.runtime as any)._tokenUsage
    };
  }
}
