import { FounderEngine }       from "./FounderEngine";
import type {
  IDashboardManager, ITimelineManager, IAgentMonitor,
  IAlertManager, INotificationManager, IWorkspaceManager,
  IResourceMonitor, ILogCollector, ISystemHealthMonitor,
} from "./interfaces";
import { FounderValidationException } from "./types";

export class FounderBuilder {
  private _context?:          any;
  private _metadata:          Record<string, unknown> = {};
  private _dashboard?:        IDashboardManager;
  private _workspace?:        IWorkspaceManager;
  private _timeline?:         ITimelineManager;
  private _agentMonitor?:     IAgentMonitor;
  private _alertManager?:     IAlertManager;
  private _notificationMgr?:  INotificationManager;
  private _resourceMonitor?:  IResourceMonitor;
  private _healthMonitor?:    ISystemHealthMonitor;
  private _logCollector?:     ILogCollector;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withMetadata(meta: Record<string, unknown>): this {
    this._metadata = { ...meta };
    return this;
  }

  public withDashboard(mgr: IDashboardManager): this {
    this._dashboard = mgr;
    return this;
  }

  public withWorkspace(mgr: IWorkspaceManager): this {
    this._workspace = mgr;
    return this;
  }

  public withTimeline(mgr: ITimelineManager): this {
    this._timeline = mgr;
    return this;
  }

  public withMonitoring(agentMonitor: IAgentMonitor): this {
    this._agentMonitor = agentMonitor;
    return this;
  }

  public withAlertManager(mgr: IAlertManager): this {
    this._alertManager = mgr;
    return this;
  }

  public withNotificationManager(mgr: INotificationManager): this {
    this._notificationMgr = mgr;
    return this;
  }

  public withResourceMonitor(mon: IResourceMonitor): this {
    this._resourceMonitor = mon;
    return this;
  }

  public withHealthMonitor(mon: ISystemHealthMonitor): this {
    this._healthMonitor = mon;
    return this;
  }

  public withLogCollector(col: ILogCollector): this {
    this._logCollector = col;
    return this;
  }

  /** Convenience: inject memory engine directly */
  public withMemory(memoryStore: any): this {
    if (!this._context) this._context = {};
    this._context.memoryStore = memoryStore;
    return this;
  }

  /** Convenience: inject decision engine directly */
  public withDecision(decisionEngine: any): this {
    if (!this._context) this._context = {};
    this._context.decisionEngine = decisionEngine;
    return this;
  }

  /** Convenience: inject planning engine directly */
  public withPlanner(planningEngine: any): this {
    if (!this._context) this._context = {};
    this._context.planningEngine = planningEngine;
    return this;
  }

  public build(): FounderEngine {
    if (!this._context) {
      throw new FounderValidationException("Context is required to build a FounderEngine.");
    }
    return new FounderEngine(
      this._context,
      this._dashboard,
      this._workspace,
      this._timeline,
      this._agentMonitor,
      this._alertManager,
      this._notificationMgr,
      this._resourceMonitor,
      this._healthMonitor,
      this._logCollector,
      this._metadata
    );
  }
}
