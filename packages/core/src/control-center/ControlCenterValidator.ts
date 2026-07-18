import { ControlCenterState }        from "./ControlCenterState";
import { OverrideType }              from "./OverrideType";
import { EmergencyLevel }            from "./EmergencyLevel";
import { BudgetState }               from "./BudgetState";
import { NotificationPriority }      from "./NotificationPriority";
import { ExecutionPermission }       from "./ExecutionPermission";
import { ControlAction }             from "./ControlAction";
import { ControlValidationException } from "./types";
import type {
  ControlRequest,
  ManualOverride,
  BudgetLimit,
  BudgetUsage,
  Notification,
  ApprovalRequest,
  ExecutionLock,
  EmergencySnapshot,
  ControlTimelineEvent,
  ControlSnapshot,
  ExecutionPermissionRule,
} from "./models";

const STATE_TRANSITIONS: Record<ControlCenterState, ControlCenterState[]> = {
  [ControlCenterState.CREATED]:        [ControlCenterState.INITIALIZED],
  [ControlCenterState.INITIALIZED]:    [ControlCenterState.MONITORING, ControlCenterState.FAILED],
  [ControlCenterState.MONITORING]:     [ControlCenterState.ACTIVE, ControlCenterState.PAUSED, ControlCenterState.EMERGENCY_STOP, ControlCenterState.FAILED],
  [ControlCenterState.ACTIVE]:         [ControlCenterState.PAUSED, ControlCenterState.EMERGENCY_STOP, ControlCenterState.COMPLETED, ControlCenterState.FAILED],
  [ControlCenterState.PAUSED]:         [ControlCenterState.ACTIVE, ControlCenterState.EMERGENCY_STOP, ControlCenterState.RECOVERING, ControlCenterState.FAILED],
  [ControlCenterState.EMERGENCY_STOP]: [ControlCenterState.RECOVERING, ControlCenterState.FAILED],
  [ControlCenterState.RECOVERING]:     [ControlCenterState.MONITORING, ControlCenterState.FAILED],
  [ControlCenterState.COMPLETED]:      [ControlCenterState.INITIALIZED],
  [ControlCenterState.FAILED]:         [ControlCenterState.RECOVERING, ControlCenterState.INITIALIZED],
};

export class ControlCenterValidator {

  // Rule 1: State transitions
  public static validateStateTransition(id: string, from: ControlCenterState, to: ControlCenterState): void {
    const allowed = STATE_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new ControlValidationException(`Invalid state transition for ${id}: ${from} -> ${to}`);
    }
  }

  // Rule 2: Duplicate override IDs
  public static validateNoDuplicateOverrides(overrides: ManualOverride[]): void {
    const seen = new Set<string>();
    for (const ov of overrides) {
      if (seen.has(ov.id)) {
        throw new ControlValidationException(`Duplicate override ID detected: ${ov.id}`);
      }
      seen.add(ov.id);
    }
  }

  // Rule 3: Invalid budget values
  public static validateBudgetLimit(limit: BudgetLimit): void {
    if (limit.limitUsd < 0) {
      throw new ControlValidationException(`Budget limit limitUsd cannot be negative: ${limit.limitUsd}`);
    }
    if (limit.alertThresholdPercent < 0 || limit.alertThresholdPercent > 100) {
      throw new ControlValidationException(`Budget alertThresholdPercent must be between 0 and 100: ${limit.alertThresholdPercent}`);
    }
  }

  // Rule 4: Budget limit consistency
  public static validateBudgetUsage(usage: BudgetUsage, limit?: BudgetLimit): void {
    if (usage.usedUsd < 0) {
      throw new ControlValidationException(`Budget usage usedUsd cannot be negative: ${usage.usedUsd}`);
    }
    if (limit && usage.usedUsd > limit.limitUsd * 2.0) {
      throw new ControlValidationException(`Budget usage ${usage.usedUsd} excessively exceeds limit ${limit.limitUsd}`);
    }
  }

  // Rule 5: Duplicate notifications
  public static validateNoDuplicateNotifications(notifications: Notification[]): void {
    const seen = new Set<string>();
    for (const n of notifications) {
      if (seen.has(n.id)) {
        throw new ControlValidationException(`Duplicate notification ID detected: ${n.id}`);
      }
      seen.add(n.id);
    }
  }

  // Rule 6: Invalid approval requests
  public static validateApprovalRequest(req: ApprovalRequest): void {
    if (!req.id || req.id.trim() === "") {
      throw new ControlValidationException("ApprovalRequest must have a valid ID");
    }
    if (!req.title || req.title.trim() === "") {
      throw new ControlValidationException("ApprovalRequest must have a valid title");
    }
    if (!req.requestedBy || req.requestedBy.trim() === "") {
      throw new ControlValidationException("ApprovalRequest must declare requester");
    }
    if (req.costEstimateUsd !== undefined && req.costEstimateUsd < 0) {
      throw new ControlValidationException(`ApprovalRequest cost estimate cannot be negative: ${req.costEstimateUsd}`);
    }
  }

  // Rule 7: Circular execution dependencies
  public static validateNoCircularDependencies(edges: [string, string][]): void {
    const adj = new Map<string, string[]>();
    for (const [from, to] of edges) {
      const list = adj.get(from) ?? [];
      list.push(to);
      adj.set(from, list);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string): boolean => {
      if (recStack.has(node)) return true;
      if (visited.has(node)) return false;

      visited.add(node);
      recStack.add(node);

      const neighbors = adj.get(node) ?? [];
      for (const neighbor of neighbors) {
        if (dfs(neighbor)) return true;
      }

      recStack.delete(node);
      return false;
    };

    for (const node of adj.keys()) {
      if (dfs(node)) {
        throw new ControlValidationException("Circular execution dependency detected!");
      }
    }
  }

  // Rule 8: Invalid rollback targets
  public static validateRollbackTarget(targetStage: string): void {
    if (!targetStage || targetStage.trim() === "") {
      throw new ControlValidationException("Rollback target stage must be a non-empty string");
    }
  }

  // Rule 9: Invalid restart checkpoints
  public static validateRestartCheckpoint(checkpointName: string): void {
    if (!checkpointName || checkpointName.trim() === "") {
      throw new ControlValidationException("Restart checkpoint name must be a non-empty string");
    }
  }

  // Rule 10: Invalid permissions
  public static validatePermissionRule(rule: ExecutionPermissionRule): void {
    if (!rule.id || rule.id.trim() === "") {
      throw new ControlValidationException("Permission rule must have a valid ID");
    }
    if (!rule.workflowId || rule.workflowId.trim() === "") {
      throw new ControlValidationException("Permission rule must apply to a workflow ID");
    }
    if (rule.expiresAt && rule.expiresAt < new Date(Date.now() - 3600_000)) {
      throw new ControlValidationException("Permission rule cannot expire in the past");
    }
  }

  // Rule 11: Emergency recovery consistency
  public static validateEmergencyRecovery(stopId: string, snapshot?: EmergencySnapshot): void {
    if (!snapshot) {
      throw new ControlValidationException(`Recovery failed: No emergency snapshot found for stop ${stopId}`);
    }
    if (snapshot.stopId !== stopId) {
      throw new ControlValidationException(`Recovery failed: Snapshot stopId ${snapshot.stopId} mismatch with requested stop ${stopId}`);
    }
  }

  // Rule 12: Timeline order
  public static validateTimelineOrder(events: ControlTimelineEvent[]): void {
    for (let i = 1; i < events.length; i++) {
      if (events[i].timestamp < events[i - 1].timestamp) {
        throw new ControlValidationException("ControlTimeline events are not in chronological order");
      }
    }
  }

  // Rule 13: Snapshot immutability
  public static validateSnapshotImmutability(snapshot: ControlSnapshot): void {
    if (!Object.isFrozen(snapshot)) {
      throw new ControlValidationException("ControlSnapshot is not frozen and is mutable");
    }
  }

  // Rule 14: Engine state consistency
  public static validateEngineStateConsistency(states: string[]): void {
    // If one engine is in EMERGENCY_STOP, other engines shouldn't remain ACTIVE without lock bounds
    const hasEmergency = states.includes("EMERGENCY_STOP");
    const hasActive = states.includes("ACTIVE") || states.includes("RUNNING");
    if (hasEmergency && hasActive) {
      throw new ControlValidationException("Inconsistent system state: active engines present during Emergency Stop");
    }
  }

  // Rule 15: Duplicate workflow locks
  public static validateNoDuplicateWorkflowLocks(locks: ExecutionLock[]): void {
    const seen = new Set<string>();
    for (const lock of locks) {
      if (seen.has(lock.workflowId)) {
        throw new ControlValidationException(`Workflow ${lock.workflowId} is already locked`);
      }
      seen.add(lock.workflowId);
    }
  }

  // Rule 16: Invalid execution actions
  public static validateExecutionAction(action: ControlAction, allowed: ControlAction[]): void {
    if (!allowed.includes(action)) {
      throw new ControlValidationException(`Action ${action} is not permitted for the current target`);
    }
  }

  // Rule 17: Invalid notification priorities
  public static validateNotificationPriority(priority: NotificationPriority): void {
    if (!Object.values(NotificationPriority).includes(priority)) {
      throw new ControlValidationException(`Invalid notification priority: ${priority}`);
    }
  }

  // Rule 18: Missing founder approvals
  public static validateFounderApprovalRequired(actionName: string, isApproved: boolean): void {
    if (!isApproved) {
      throw new ControlValidationException(`Founder approval required before executing: ${actionName}`);
    }
  }

  // Rule 19: Recovery snapshot integrity
  public static validateRecoverySnapshotIntegrity(snapshot: EmergencySnapshot): void {
    if (snapshot.systemHealthScore < 0 || snapshot.systemHealthScore > 100) {
      throw new ControlValidationException(`Recovery snapshot health score ${snapshot.systemHealthScore} is out of bounds`);
    }
  }

  // Rule 20: Empty control requests
  public static validateControlRequest(req: ControlRequest): void {
    if (!req.id || req.id.trim() === "") {
      throw new ControlValidationException("ControlRequest must have a non-empty ID");
    }
    if (!req.action) {
      throw new ControlValidationException("ControlRequest must define an action");
    }
  }
}
