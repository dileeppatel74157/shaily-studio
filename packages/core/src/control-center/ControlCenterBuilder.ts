import { ControlCenterEngine } from "./ControlCenterEngine";
import { ControlValidationException } from "./types";

export class ControlCenterBuilder {
  private _context?: any;
  private _metadata: Record<string, unknown> = {};
  
  // Custom managers or overrides (optional)
  private _overrideManager?: any;
  private _budgetManager?: any;
  private _emergencyManager?: any;
  private _notificationManager?: any;
  private _approvalManager?: any;
  private _permissionManager?: any;
  private _executionController?: any;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...metadata };
    return this;
  }

  public withDashboard(dashboardManager?: any): this {
    // Optional dashboard custom integration
    return this;
  }

  public withWorkspace(workspaceManager?: any): this {
    // Optional workspace integration
    return this;
  }

  public withTimeline(timelineManager?: any): this {
    // Optional timeline custom integration
    return this;
  }

  public withMonitoring(monitoringSystem?: any): this {
    return this;
  }

  public withAlertManager(alertManager?: any): this {
    return this;
  }

  public withNotificationManager(notificationManager?: any): this {
    this._notificationManager = notificationManager;
    return this;
  }

  public withResourceMonitor(resourceMonitor?: any): this {
    return this;
  }

  public withHealthMonitor(healthMonitor?: any): this {
    return this;
  }

  public withMemory(memoryStore?: any): this {
    if (!this._context) this._context = {};
    this._context.memoryStore = memoryStore;
    return this;
  }

  public withDecision(decisionEngine?: any): this {
    if (!this._context) this._context = {};
    this._context.decisionEngine = decisionEngine;
    return this;
  }

  public withPlanner(planningEngine?: any): this {
    if (!this._context) this._context = {};
    this._context.planningEngine = planningEngine;
    return this;
  }

  // Set explicit sub-managers for testing / custom control
  public withOverrideManager(mgr: any): this {
    this._overrideManager = mgr;
    return this;
  }

  public withBudgetManager(mgr: any): this {
    this._budgetManager = mgr;
    return this;
  }

  public withEmergencyManager(mgr: any): this {
    this._emergencyManager = mgr;
    return this;
  }

  public withApprovalManager(mgr: any): this {
    this._approvalManager = mgr;
    return this;
  }

  public withPermissionManager(mgr: any): this {
    this._permissionManager = mgr;
    return this;
  }

  public withExecutionController(ctrl: any): this {
    this._executionController = ctrl;
    return this;
  }

  public build(): ControlCenterEngine {
    if (!this._context) {
      throw new ControlValidationException("Context is required to build a ControlCenterEngine.");
    }
    return new ControlCenterEngine(
      this._context,
      this._overrideManager,
      this._budgetManager,
      this._emergencyManager,
      this._notificationManager,
      this._approvalManager,
      this._permissionManager,
      this._executionController,
      this._metadata
    );
  }
}
