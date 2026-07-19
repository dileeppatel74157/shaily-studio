import { AssistantState } from "./AssistantState";
import { IntentType } from "./IntentType";
import { CommandType } from "./CommandType";
import { EntityType } from "./EntityType";
import { ResponseType } from "./ResponseType";
import { PlannerState } from "./PlannerState";
import { ConversationState } from "./ConversationState";
import { ConfidenceLevel } from "./ConfidenceLevel";
import {
  AssistantValidationException,
  InvalidAssistantStateException
} from "./types";
import {
  ParsedIntent,
  Entity,
  Slot,
  ExecutionPlan,
  ExecutionStep,
  ConversationMessage,
  AssistantSnapshot,
  AssistantSession
} from "./models";

export class AssistantValidator {
  /**
   * 1. Validate Command Syntax.
   */
  public static validateCommandSyntax(command: string): void {
    if (!command || typeof command !== "string") {
      throw new AssistantValidationException("Command must be a non-empty string.");
    }
    if (command.trim().length === 0) {
      throw new AssistantValidationException("Command cannot be only whitespace.");
    }
  }

  /**
   * 2. Validate Intent Confidence.
   */
  public static validateIntentConfidence(parsed: ParsedIntent, threshold = 0.5): void {
    if (parsed.intent.confidence < threshold) {
      throw new AssistantValidationException(`Intent confidence "${parsed.intent.confidence}" is below threshold "${threshold}".`);
    }
  }

  /**
   * 3. Validate Required Slots are Filled.
   */
  public static validateRequiredSlots(slots: Slot[]): void {
    for (const slot of slots) {
      if (slot.required && !slot.filled) {
        throw new AssistantValidationException(`Required parameter/slot "${slot.name}" is missing.`);
      }
    }
  }

  /**
   * 4. Validate Unknown Entities.
   */
  public static validateUnknownEntities(entities: Entity[]): void {
    for (const ent of entities) {
      if (ent.type === EntityType.UNKNOWN) {
        throw new AssistantValidationException(`Unknown entity type detected for value "${ent.value}".`);
      }
    }
  }

  /**
   * 5. Validate Session Identifier.
   */
  public static validateSessionId(sessionId: string): void {
    if (!sessionId || typeof sessionId !== "string") {
      throw new AssistantValidationException("Session ID must be a non-empty string.");
    }
    const regex = /^[a-zA-Z0-9_\-]+$/;
    if (!regex.test(sessionId)) {
      throw new AssistantValidationException(`Session ID "${sessionId}" contains illegal characters.`);
    }
  }

  /**
   * 6. Validate Step Dependencies.
   */
  public static validateStepDependencies(steps: ExecutionStep[]): void {
    const stepIds = new Set(steps.map(s => s.id));
    for (const step of steps) {
      for (const depId of step.dependsOnStepIds) {
        if (!stepIds.has(depId)) {
          throw new AssistantValidationException(`Step "${step.id}" depends on non-existent step "${depId}".`);
        }
        if (depId === step.id) {
          throw new AssistantValidationException(`Step "${step.id}" cannot depend on itself.`);
        }
      }
    }

    // Cyclic check
    const adj = new Map<string, string[]>();
    for (const s of steps) {
      adj.set(s.id, s.dependsOnStepIds);
    }
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (id: string): boolean => {
      visited.add(id);
      recStack.add(id);
      for (const dep of adj.get(id) || []) {
        if (!visited.has(dep)) {
          if (dfs(dep)) return true;
        } else if (recStack.has(dep)) {
          return true;
        }
      }
      recStack.delete(id);
      return false;
    };

    for (const s of steps) {
      if (!visited.has(s.id)) {
        if (dfs(s.id)) {
          throw new AssistantValidationException("Execution plan contains cyclic step dependencies.");
        }
      }
    }
  }

  /**
   * 7. Validate Execution Permissions.
   */
  public static validateExecutionPermissions(plan: ExecutionPlan, userRole = "admin"): void {
    if (plan.intentType === IntentType.SYSTEM && userRole !== "admin") {
      throw new AssistantValidationException("Unauthorized to execute system operations.");
    }
  }

  /**
   * 8. Validate Snapshot Immutability.
   */
  public static validateSnapshotImmutability(snapshot: AssistantSnapshot): void {
    if (!snapshot) {
      throw new AssistantValidationException("Snapshot is missing.");
    }
    if (!Object.isFrozen(snapshot)) {
      throw new AssistantValidationException("AssistantSnapshot is not frozen.");
    }
    if (!Object.isFrozen(snapshot.report)) {
      throw new AssistantValidationException("AssistantSnapshot report is not frozen.");
    }
  }

  /**
   * 9. Validate State Transition.
   */
  public static validateStateTransition(current: AssistantState, target: AssistantState): void {
    const allowed: Record<AssistantState, AssistantState[]> = {
      [AssistantState.CREATED]: [AssistantState.INITIALIZING, AssistantState.FAILED],
      [AssistantState.INITIALIZING]: [AssistantState.LISTENING, AssistantState.FAILED],
      [AssistantState.LISTENING]: [AssistantState.PROCESSING, AssistantState.FAILED],
      [AssistantState.PROCESSING]: [AssistantState.PLANNING, AssistantState.RESPONDING, AssistantState.FAILED],
      [AssistantState.PLANNING]: [AssistantState.EXECUTING, AssistantState.RESPONDING, AssistantState.FAILED],
      [AssistantState.EXECUTING]: [AssistantState.RESPONDING, AssistantState.FAILED],
      [AssistantState.RESPONDING]: [AssistantState.LISTENING, AssistantState.COMPLETED, AssistantState.FAILED],
      [AssistantState.COMPLETED]: [AssistantState.LISTENING, AssistantState.FAILED],
      [AssistantState.FAILED]: [AssistantState.INITIALIZING, AssistantState.LISTENING, AssistantState.FAILED]
    };
    if (!allowed[current].includes(target)) {
      throw new InvalidAssistantStateException(`transition from ${current} to ${target}`, current);
    }
  }

  /**
   * 10. Validate PlannerState Transition.
   */
  public static validatePlannerStateTransition(current: PlannerState, target: PlannerState): void {
    const allowed: Record<PlannerState, PlannerState[]> = {
      [PlannerState.CREATED]: [PlannerState.PARSING, PlannerState.FAILED],
      [PlannerState.PARSING]: [PlannerState.PLANNING, PlannerState.FAILED],
      [PlannerState.PLANNING]: [PlannerState.READY, PlannerState.FAILED],
      [PlannerState.READY]: [PlannerState.EXECUTING, PlannerState.FAILED],
      [PlannerState.EXECUTING]: [PlannerState.COMPLETED, PlannerState.FAILED],
      [PlannerState.COMPLETED]: [PlannerState.PARSING, PlannerState.FAILED],
      [PlannerState.FAILED]: [PlannerState.CREATED, PlannerState.PARSING, PlannerState.FAILED]
    };
    if (!allowed[current].includes(target)) {
      throw new AssistantValidationException(`Invalid planner state transition from ${current} to ${target}`);
    }
  }

  /**
   * 11. Validate Confidence Level format.
   */
  public static validateConfidenceLevel(level: ConfidenceLevel): void {
    if (!Object.values(ConfidenceLevel).includes(level)) {
      throw new AssistantValidationException(`Invalid confidence level "${level}".`);
    }
  }

  /**
   * 12. Validate Entity Start/End indices.
   */
  public static validateEntityRange(ent: Entity): void {
    if (ent.startIndex < 0 || ent.endIndex < ent.startIndex) {
      throw new AssistantValidationException(`Invalid entity range indexes [${ent.startIndex}, ${ent.endIndex}].`);
    }
  }

  /**
   * 13. Validate Entity confidence rating.
   */
  public static validateEntityConfidence(ent: Entity): void {
    if (ent.confidence < 0 || ent.confidence > 1) {
      throw new AssistantValidationException(`Invalid entity confidence ${ent.confidence}. Must be between 0 and 1.`);
    }
  }

  /**
   * 14. Validate Conversation Consistency.
   */
  public static validateConversationHistory(messages: ConversationMessage[]): void {
    if (!Array.isArray(messages)) {
      throw new AssistantValidationException("History messages must be an array.");
    }
    let lastRole: string | undefined = undefined;
    for (const msg of messages) {
      if (!msg.content || typeof msg.content !== "string") {
        throw new AssistantValidationException("Message content must be a non-empty string.");
      }
      if (msg.role === lastRole && msg.role !== "system") {
        throw new AssistantValidationException(`Consecutive identical roles "${msg.role}" detected.`);
      }
      lastRole = msg.role;
    }
  }

  /**
   * 15. Validate ResponseType.
   */
  public static validateResponseType(type: ResponseType): void {
    if (!Object.values(ResponseType).includes(type)) {
      throw new AssistantValidationException(`Invalid ResponseType "${type}".`);
    }
  }

  /**
   * 16. Validate ExecutionPlan.
   */
  public static validateExecutionPlan(plan: ExecutionPlan): void {
    if (!plan) {
      throw new AssistantValidationException("Execution plan is missing.");
    }
    this.validateSessionId(plan.id);
    if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
      throw new AssistantValidationException("Execution plan must contain at least one step.");
    }
  }

  /**
   * 17. Validate ExecutionStep Parameters.
   */
  public static validateExecutionStep(step: ExecutionStep): void {
    this.validateSessionId(step.id);
    if (!step.name || typeof step.name !== "string") {
      throw new AssistantValidationException("Execution step name must be a non-empty string.");
    }
    if (!step.targetEngine || typeof step.targetEngine !== "string") {
      throw new AssistantValidationException("Execution step targetEngine must be a non-empty string.");
    }
    if (!step.parameters || typeof step.parameters !== "object") {
      throw new AssistantValidationException("Execution step parameters must be an object.");
    }
  }

  /**
   * 18. Validate Cost Estimate.
   */
  public static validateCostEstimate(cost: number): void {
    if (typeof cost !== "number" || cost < 0) {
      throw new AssistantValidationException(`Cost estimate "${cost}" must be a non-negative number.`);
    }
  }

  /**
   * 19. Validate Duration Estimate.
   */
  public static validateDurationEstimate(durationMs: number): void {
    if (typeof durationMs !== "number" || durationMs < 0) {
      throw new AssistantValidationException(`Duration estimate "${durationMs}" must be a non-negative number.`);
    }
  }

  /**
   * 20. Validate Slot required flag consistency.
   */
  public static validateSlot(slot: Slot): void {
    if (!slot.name || typeof slot.name !== "string") {
      throw new AssistantValidationException("Slot name must be a non-empty string.");
    }
    if (slot.filled && slot.value === undefined) {
      throw new AssistantValidationException(`Slot "${slot.name}" marked filled but has undefined value.`);
    }
  }

  /**
   * 21. Validate Session State.
   */
  public static validateSession(session: AssistantSession): void {
    if (!session) {
      throw new AssistantValidationException("Session is missing.");
    }
    this.validateSessionId(session.id);
    if (!Object.values(ConversationState).includes(session.state)) {
      throw new AssistantValidationException(`Invalid session conversation state "${session.state}".`);
    }
  }
}
