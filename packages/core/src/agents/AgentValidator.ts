import { AgentState } from "./AgentState";
import { AgentRole } from "./AgentRole";
import { AgentCapability } from "./AgentCapability";
import { AgentTask } from "./AgentTask";
import { AgentConfiguration } from "./AgentConfiguration";

export class AgentValidator {
  public static validateAgent(agent: {
    id: string;
    name: string;
    role: AgentRole;
    capabilities: ReadonlyArray<AgentCapability>;
  }): void {
    if (!agent.id || typeof agent.id !== "string" || agent.id.trim() === "") {
      throw new Error("Invalid agent ID: ID must be a non-empty string.");
    }
    if (!agent.name || typeof agent.name !== "string" || agent.name.trim() === "") {
      throw new Error("Invalid agent name: Name must be a non-empty string.");
    }
    if (!agent.role || typeof agent.role !== "string" || agent.role.trim() === "") {
      throw new Error("Invalid agent role: Role must be a non-empty string.");
    }
    if (!Array.isArray(agent.capabilities)) {
      throw new Error("Invalid capabilities: Capabilities must be an array.");
    }
    for (const cap of agent.capabilities) {
      if (typeof cap !== "string" || cap.trim() === "") {
        throw new Error("Invalid capability: Capability must be a non-empty string.");
      }
    }
  }

  public static validateLifecycleTransition(current: AgentState, target: AgentState): void {
    const allowedTransitions: Record<AgentState, AgentState[]> = {
      [AgentState.CREATED]: [AgentState.READY, AgentState.FAILED],
      [AgentState.READY]: [AgentState.RUNNING, AgentState.STOPPED, AgentState.FAILED],
      [AgentState.RUNNING]: [AgentState.COMPLETED, AgentState.PAUSED, AgentState.STOPPED, AgentState.FAILED],
      [AgentState.PAUSED]: [AgentState.RUNNING, AgentState.STOPPED, AgentState.FAILED],
      [AgentState.COMPLETED]: [AgentState.RUNNING, AgentState.STOPPED],
      [AgentState.STOPPED]: [AgentState.READY, AgentState.RUNNING],
      [AgentState.FAILED]: [AgentState.READY, AgentState.RUNNING],
    };

    const allowed = allowedTransitions[current] || [];
    if (!allowed.includes(target)) {
      throw new Error(`Invalid lifecycle transition from ${current} to ${target}`);
    }
  }

  public static validateExecutionConstraints(task: AgentTask, constraints?: AgentConfiguration): void {
    if (constraints && constraints.timeoutMs !== undefined && constraints.timeoutMs <= 0) {
      throw new Error("Execution constraint error: timeoutMs must be greater than 0");
    }
  }
}
