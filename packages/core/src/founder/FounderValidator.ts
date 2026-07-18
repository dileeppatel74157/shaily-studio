import { FounderState }         from "./FounderState";
import { AlertSeverity }        from "./AlertSeverity";
import { DashboardWidgetType }  from "./DashboardWidgetType";
import { FounderValidationException } from "./types";
import type {
  FounderDashboard, WidgetLayout, Alert, TimelineEvent, ExecutionProgress,
  ResourceUsage, GpuUsage, MemoryUsage, Notification, WorkspaceSnapshot,
} from "./models";

// ─── Allowed State Transitions ────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<FounderState, FounderState[]> = {
  [FounderState.CREATED]:     [FounderState.INITIALIZED],
  [FounderState.INITIALIZED]: [FounderState.RUNNING, FounderState.FAILED],
  [FounderState.RUNNING]:     [FounderState.PAUSED, FounderState.STOPPED, FounderState.FAILED],
  [FounderState.PAUSED]:      [FounderState.RUNNING, FounderState.STOPPED],
  [FounderState.STOPPED]:     [FounderState.INITIALIZED],
  [FounderState.FAILED]:      [FounderState.RECOVERING, FounderState.STOPPED],
  [FounderState.RECOVERING]:  [FounderState.RUNNING, FounderState.FAILED],
};

export class FounderValidator {

  // ─── State Transitions ──────────────────────────────────────────────────────

  public static validateStateTransition(id: string, from: FounderState, to: FounderState): void {
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new FounderValidationException(
        `Invalid state transition for "${id}": ${from} → ${to}. Allowed: [${allowed.join(", ")}]`
      );
    }
  }

  // ─── Dashboard ──────────────────────────────────────────────────────────────

  public static validateDashboard(dashboard: FounderDashboard): void {
    if (!dashboard.id || dashboard.id.trim().length === 0) {
      throw new FounderValidationException("Dashboard must have a non-empty ID.");
    }
    if (!dashboard.name || dashboard.name.trim().length === 0) {
      throw new FounderValidationException("Dashboard must have a non-empty name.");
    }
    // Duplicate widget IDs
    const widgetIds = dashboard.widgets.map(w => w.id);
    const seen = new Set<string>();
    for (const wid of widgetIds) {
      if (seen.has(wid)) throw new FounderValidationException(`Duplicate widget ID "${wid}" in dashboard "${dashboard.id}".`);
      seen.add(wid);
    }
    // Duplicate widget types
    const types = dashboard.widgets.map(w => w.type);
    const seenTypes = new Set<DashboardWidgetType>();
    for (const t of types) {
      if (seenTypes.has(t)) throw new FounderValidationException(`Duplicate widget type "${t}" in dashboard "${dashboard.id}".`);
      seenTypes.add(t);
    }
  }

  // ─── Widget Layout ──────────────────────────────────────────────────────────

  public static validateLayout(layout: WidgetLayout[]): void {
    for (const w of layout) {
      if (w.width < 1 || w.width > 12) {
        throw new FounderValidationException(`Widget "${w.widgetId}" width ${w.width} must be between 1 and 12.`);
      }
      if (w.height < 1) {
        throw new FounderValidationException(`Widget "${w.widgetId}" height must be ≥ 1.`);
      }
      if (w.row < 0 || w.col < 0) {
        throw new FounderValidationException(`Widget "${w.widgetId}" row/col must be non-negative.`);
      }
    }
  }

  // ─── Alerts ─────────────────────────────────────────────────────────────────

  public static validateAlert(alert: Alert): void {
    if (!alert.id || alert.id.trim().length === 0) {
      throw new FounderValidationException("Alert must have a non-empty ID.");
    }
    if (!alert.title || alert.title.trim().length === 0) {
      throw new FounderValidationException("Alert must have a non-empty title.");
    }
    if (!Object.values(AlertSeverity).includes(alert.severity)) {
      throw new FounderValidationException(`Invalid alert severity "${alert.severity}".`);
    }
    if (alert.resolvedAt && !alert.resolved) {
      throw new FounderValidationException(`Alert "${alert.id}" has resolvedAt but resolved=false.`);
    }
  }

  public static validateNoDuplicateAlerts(alerts: Alert[]): void {
    const seen = new Set<string>();
    for (const a of alerts) {
      if (seen.has(a.id)) throw new FounderValidationException(`Duplicate alert ID "${a.id}".`);
      seen.add(a.id);
    }
  }

  // ─── Timeline Order ─────────────────────────────────────────────────────────

  public static validateTimelineOrder(events: TimelineEvent[]): void {
    for (let i = 1; i < events.length; i++) {
      if (events[i].timestamp < events[i - 1].timestamp) {
        throw new FounderValidationException(
          `Timeline event "${events[i].id}" has timestamp before previous event. Events must be in chronological order.`
        );
      }
    }
  }

  // ─── Execution Progress ─────────────────────────────────────────────────────

  public static validateExecutionProgress(progress: ExecutionProgress): void {
    if (progress.totalStages < 1) {
      throw new FounderValidationException("ExecutionProgress must have at least 1 total stage.");
    }
    if (progress.completedStages > progress.totalStages) {
      throw new FounderValidationException(`completedStages (${progress.completedStages}) exceeds totalStages (${progress.totalStages}).`);
    }
    if (progress.progressPercent < 0 || progress.progressPercent > 100) {
      throw new FounderValidationException(`progressPercent ${progress.progressPercent} must be between 0 and 100.`);
    }
    if (progress.failedStages < 0) {
      throw new FounderValidationException("failedStages must be ≥ 0.");
    }
  }

  // ─── Resource Ranges ────────────────────────────────────────────────────────

  public static validateResourceUsage(res: ResourceUsage): void {
    if (res.cpuPercent < 0 || res.cpuPercent > 100) {
      throw new FounderValidationException(`cpuPercent ${res.cpuPercent} must be 0–100.`);
    }
    if (res.costs.totalUsd < 0) {
      throw new FounderValidationException("totalCostUsd must be ≥ 0.");
    }
    if (res.costs.budgetUsedPercent < 0 || res.costs.budgetUsedPercent > 100) {
      throw new FounderValidationException(`budgetUsedPercent ${res.costs.budgetUsedPercent} must be 0–100.`);
    }
  }

  // ─── GPU Usage ──────────────────────────────────────────────────────────────

  public static validateGpuUsage(gpu: GpuUsage): void {
    if (gpu.utilizationPercent < 0 || gpu.utilizationPercent > 100) {
      throw new FounderValidationException(`GPU utilizationPercent ${gpu.utilizationPercent} must be 0–100.`);
    }
    if (gpu.memoryUsedMb > gpu.memoryTotalMb) {
      throw new FounderValidationException(`GPU memoryUsedMb (${gpu.memoryUsedMb}) exceeds memoryTotalMb (${gpu.memoryTotalMb}).`);
    }
    if (gpu.temperatureC < 0) {
      throw new FounderValidationException("GPU temperatureC must be ≥ 0.");
    }
  }

  // ─── Memory Usage ───────────────────────────────────────────────────────────

  public static validateMemoryUsage(mem: MemoryUsage): void {
    if (mem.usedMb > mem.totalMb) {
      throw new FounderValidationException(`Memory usedMb (${mem.usedMb}) exceeds totalMb (${mem.totalMb}).`);
    }
    if (mem.usedPercent < 0 || mem.usedPercent > 100) {
      throw new FounderValidationException(`Memory usedPercent ${mem.usedPercent} must be 0–100.`);
    }
    if (mem.freeMb < 0) {
      throw new FounderValidationException("Memory freeMb must be ≥ 0.");
    }
  }

  // ─── Notification ───────────────────────────────────────────────────────────

  public static validateNotification(n: Notification): void {
    if (!n.id || n.id.trim().length === 0) {
      throw new FounderValidationException("Notification must have a non-empty ID.");
    }
    if (!n.title || n.title.trim().length === 0) {
      throw new FounderValidationException("Notification must have a non-empty title.");
    }
    if (n.expiresAt && n.expiresAt <= n.createdAt) {
      throw new FounderValidationException(`Notification "${n.id}" expiresAt must be after createdAt.`);
    }
  }

  // ─── Snapshot Integrity ─────────────────────────────────────────────────────

  public static validateSnapshot(snap: WorkspaceSnapshot): void {
    if (!snap.id || snap.id.trim().length === 0) {
      throw new FounderValidationException("WorkspaceSnapshot must have a non-empty ID.");
    }
    if (!snap.workspaceId || snap.workspaceId.trim().length === 0) {
      throw new FounderValidationException("WorkspaceSnapshot must reference a workspaceId.");
    }
    if (!snap.state) {
      throw new FounderValidationException("WorkspaceSnapshot must contain a state.");
    }
  }
}
