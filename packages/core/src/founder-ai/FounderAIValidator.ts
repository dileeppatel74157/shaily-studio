import {
  FounderProfile,
  FounderGoal,
  FounderDecision,
  FounderTask,
  FounderSession,
  FounderRecommendation,
  FounderExecutionPlan,
  FounderDailyBrief,
  FounderFocusArea,
  FounderContext,
  FounderMission,
  FounderStrategy,
  FounderTimeline,
  FounderStatistics,
  FounderSnapshot
} from "./models";
import { FounderValidationException } from "./exceptions";

export class FounderAIValidator {
  public validateSnapshot(snap: FounderSnapshot): void {
    if (!snap) {
      throw new FounderValidationException("Snapshot is undefined.");
    }
    this.validateProfile(snap.profile);
    
    // Validate goals uniqueness
    const goalIds = new Set<string>();
    for (const g of snap.goals) {
      if (goalIds.has(g.id)) {
        throw new FounderValidationException(`Duplicate goal ID detected: ${g.id}`);
      }
      goalIds.add(g.id);
      this.validateGoal(g);
    }
    
    this.validateStatistics(snap.statistics);
  }

  // 1-2. Profile Validation
  public validateProfile(profile: FounderProfile): void {
    if (!profile) {
      throw new FounderValidationException("Founder profile is missing.");
    }
    if (!profile.name || profile.name.trim() === "") {
      throw new FounderValidationException("Founder name cannot be empty.");
    }
  }

  // 3-6. Goal Validation
  public validateGoal(goal: FounderGoal): void {
    if (!goal.title || goal.title.trim() === "") {
      throw new FounderValidationException("Goal title is required.");
    }
    if (goal.priority < 1 || goal.priority > 10) {
      throw new FounderValidationException(`Priority must be between 1 and 10. Got: ${goal.priority}`);
    }
    if (!goal.deadline || isNaN(goal.deadline.getTime())) {
      throw new FounderValidationException("Goal deadline is invalid.");
    }
  }

  // 7-8. Recommendation Validation
  public validateRecommendation(rec: FounderRecommendation): void {
    if (rec.confidence < 0 || rec.confidence > 100) {
      throw new FounderValidationException(`Recommendation confidence must be between 0 and 100. Got: ${rec.confidence}`);
    }
  }

  // 9. Decision Validation
  public validateDecision(dec: FounderDecision): void {
    if (dec.chosenOption && (!dec.reason || dec.reason.trim() === "")) {
      throw new FounderValidationException(`Evaluated decision option "${dec.chosenOption}" must contain a justification reason.`);
    }
  }

  // 10. Task Validation
  public validateTask(task: FounderTask): void {
    if (!task.projectId || task.projectId.trim() === "") {
      throw new FounderValidationException("Task must be linked to a valid project ID.");
    }
  }

  // 11. Session Validation
  public validateSession(session: FounderSession): void {
    if (!session.id) {
      throw new FounderValidationException("Session ID is required.");
    }
  }

  // 12. Timeline Validation
  public validateTimeline(timeline: FounderTimeline): void {
    let lastTime = 0;
    for (const e of timeline.events) {
      const t = e.time.getTime();
      if (t < lastTime) {
        throw new FounderValidationException("Timeline events must be in chronological order.");
      }
      lastTime = t;
    }
  }

  // 13. Statistics Validation
  public validateStatistics(stats: FounderStatistics): void {
    if (stats.tasksCompleted < 0 || stats.goalsCompleted < 0 || stats.hoursSaved < 0 || stats.moneySpent < 0) {
      throw new FounderValidationException("Statistics values cannot be negative.");
    }
  }

  // 14. Focus Area Validation
  public validateFocusArea(area: FounderFocusArea): void {
    if (!area.niche || area.niche.trim() === "") {
      throw new FounderValidationException("Focus area must specify a valid niche.");
    }
  }

  // 15. Context Validation
  public validateContext(ctx: FounderContext): void {
    if (!ctx.namespace || ctx.namespace.trim() === "") {
      throw new FounderValidationException("Context must define a valid namespace.");
    }
  }

  // 16. Mission Validation
  public validateMission(mission: FounderMission): void {
    if (!mission.statement || mission.statement.trim() === "") {
      throw new FounderValidationException("Mission statement cannot be empty.");
    }
  }

  // 17. Strategy Validation
  public validateStrategy(strategy: FounderStrategy): void {
    if (strategy.tasksLinked.length === 0) {
      throw new FounderValidationException("Strategy must be linked to at least one task.");
    }
  }

  // 18. Daily Brief Validation
  public validateDailyBrief(brief: FounderDailyBrief): void {
    if (brief.priorities.length === 0) {
      throw new FounderValidationException("Daily brief priorities checklist cannot be empty.");
    }
  }

  // 19. Execution Plan Validation
  public validateExecutionPlan(plan: FounderExecutionPlan): void {
    if (plan.steps.length === 0) {
      throw new FounderValidationException("Execution plan must contain at least one step.");
    }
  }

  // 20. General Snapshot Immutability check helper
  public validateSnapshotImmutability(snapshot: FounderSnapshot): void {
    if (!Object.isFrozen(snapshot)) {
      throw new FounderValidationException("Snapshot must be immutable (frozen).");
    }
  }
}
