import { SystemSnapshot, DependencyGraph } from "./models";
import { IntegrationState } from "./IntegrationState";
import { IntegrationValidationException } from "./types";

export class IntegrationValidator {
  public async validate(snapshot: SystemSnapshot): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    // 1. Manifest / State Check
    if (!snapshot.integrationState) {
      issues.push("System IntegrationState is undefined.");
    }

    // 2-5. Required Core Engines Registration Check
    const registeredIds = new Set(snapshot.registrations.map(r => r.id));
    const requiredCore = [
      "RuntimeEngine",
      "WorkspaceEngine",
      "AssistantEngine",
      "TaskSchedulerEngine",
      "SettingsEngine",
      "PipelineEngine",
      "KnowledgeBaseEngine",
      "MemoryOptimizationEngine"
    ];

    requiredCore.forEach(id => {
      if (!registeredIds.has(id)) {
        issues.push(`Critical core engine "${id}" is missing from registrations.`);
      }
    });

    // 6-8. Provider & Task Engines Check
    const taskEngines = [
      "ResearchEngine",
      "StrategyEngine",
      "ChannelEngine",
      "ScriptEngine",
      "ProductionEngine",
      "ImageGenerationEngine",
      "VideoGenerationEngine"
    ];
    taskEngines.forEach(id => {
      if (!registeredIds.has(id)) {
        issues.push(`Required pipeline stage engine "${id}" is missing.`);
      }
    });

    // 9. Duplicate engine registrations check
    const duplicateCheck = new Set<string>();
    snapshot.registrations.forEach(r => {
      if (duplicateCheck.has(r.id)) {
        issues.push(`Duplicate engine registration found for ID: ${r.id}`);
      }
      duplicateCheck.add(r.id);
    });

    // 10. Health Level Validation
    if (!snapshot.healthLevel) {
      issues.push("System HealthLevel is missing.");
    }

    // 11. Configuration check
    if (!snapshot.activeConfiguration) {
      issues.push("System IntegrationConfiguration is missing.");
    } else {
      if (snapshot.activeConfiguration.stateSyncIntervalMs <= 0) {
        issues.push("State sync interval must be greater than zero.");
      }
      if (snapshot.activeConfiguration.healthCheckIntervalMs <= 0) {
        issues.push("Health check interval must be greater than zero.");
      }
    }

    const isValid = issues.length === 0;
    return { isValid, issues };
  }

  // 12-14. Dependency graph validator
  public validateDependencyGraph(graph: DependencyGraph): void {
    if (graph.hasCircularDependency) {
      throw new IntegrationValidationException("Circular dependencies detected in engine graph.");
    }
    if (graph.unresolvedDependencies.length > 0) {
      throw new IntegrationValidationException(
        `Unresolved dependencies in engine graph: ${graph.unresolvedDependencies.join(", ")}`
      );
    }
  }

  // 15-17. Context & Event checks
  public validateContextKeys(agentContext: any, planningContext: any): void {
    if (!agentContext || !planningContext) {
      throw new IntegrationValidationException("Agent or Planning context is null.");
    }
    // Verify some shared objects are present
    if (!agentContext.eventBus || !planningContext.eventBus) {
      throw new IntegrationValidationException("Context EventBus is missing.");
    }
  }

  // 18-20. State Transition rules
  public validateStateTransition(current: IntegrationState, next: IntegrationState): void {
    const validTransitions: Record<IntegrationState, IntegrationState[]> = {
      [IntegrationState.CREATED]: [IntegrationState.INITIALIZING, IntegrationState.FAILED],
      [IntegrationState.INITIALIZING]: [IntegrationState.DISCOVERING, IntegrationState.FAILED],
      [IntegrationState.DISCOVERING]: [IntegrationState.REGISTERING, IntegrationState.FAILED],
      [IntegrationState.REGISTERING]: [IntegrationState.SYNCHRONIZING, IntegrationState.FAILED],
      [IntegrationState.SYNCHRONIZING]: [IntegrationState.READY, IntegrationState.FAILED],
      [IntegrationState.READY]: [IntegrationState.STOPPED, IntegrationState.FAILED],
      [IntegrationState.FAILED]: [IntegrationState.INITIALIZING],
      [IntegrationState.STOPPED]: [IntegrationState.INITIALIZING]
    };

    if (!validTransitions[current]?.includes(next)) {
      throw new IntegrationValidationException(`Invalid integration state transition: ${current} -> ${next}`);
    }
  }
}
