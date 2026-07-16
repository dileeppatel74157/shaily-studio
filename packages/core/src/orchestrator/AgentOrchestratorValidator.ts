import { AgentTeam } from "./AgentTeam";
import { TeamMember } from "./TeamMember";
import { TeamTask } from "./TeamTask";
import { AgentOrchestratorState } from "./AgentOrchestratorState";
import { OrchestratorValidationException, InvalidOrchestratorStateException } from "./types";

export class AgentOrchestratorValidator {
  public validateTeam(teamName: string, existingTeams: Map<string, AgentTeam>): void {
    if (!teamName || teamName.trim() === "") {
      throw new OrchestratorValidationException("Team name cannot be empty.");
    }
    for (const team of existingTeams.values()) {
      if (team.name.toLowerCase() === teamName.toLowerCase()) {
        throw new OrchestratorValidationException(`Team name "${teamName}" already exists (Duplicate teams check).`);
      }
    }
  }

  public validateMember(member: Omit<TeamMember, "joinedAt">, currentMembers: ReadonlyArray<TeamMember>): void {
    if (!member.agentId || member.agentId.trim() === "") {
      throw new OrchestratorValidationException("Member agentId cannot be empty.");
    }
    if (currentMembers.some((m) => m.agentId === member.agentId)) {
      throw new OrchestratorValidationException(`Member agentId "${member.agentId}" already exists in the team (Duplicate members check).`);
    }
  }

  public validateLeader(leaderId: string, currentMembers: ReadonlyArray<TeamMember>): void {
    if (!currentMembers.some((m) => m.agentId === leaderId)) {
      throw new OrchestratorValidationException(`Selected leader "${leaderId}" is not a member of the team (Invalid leader check).`);
    }
  }

  public validateDependencyCycles(tasks: ReadonlyArray<TeamTask>): void {
    const adj = new Map<string, string[]>();
    for (const t of tasks) {
      adj.set(t.id, [...t.dependencies]);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string): boolean => {
      if (recStack.has(node)) return true;
      if (visited.has(node)) return false;

      visited.add(node);
      recStack.add(node);

      const neighbors = adj.get(node) || [];
      for (const n of neighbors) {
        if (dfs(n)) return true;
      }

      recStack.delete(node);
      return false;
    };

    for (const t of tasks) {
      if (dfs(t.id)) {
        throw new OrchestratorValidationException("Circular dependency detected in tasks (Dependency cycles check).");
      }
    }
  }

  public validateStateTransition(current: AgentOrchestratorState, target: AgentOrchestratorState): void {
    const allowedTransitions: Record<AgentOrchestratorState, AgentOrchestratorState[]> = {
      [AgentOrchestratorState.CREATED]: [AgentOrchestratorState.READY, AgentOrchestratorState.FAILED],
      [AgentOrchestratorState.READY]: [AgentOrchestratorState.RUNNING, AgentOrchestratorState.STOPPED, AgentOrchestratorState.FAILED],
      [AgentOrchestratorState.RUNNING]: [AgentOrchestratorState.STOPPED, AgentOrchestratorState.FAILED],
      [AgentOrchestratorState.STOPPED]: [AgentOrchestratorState.READY, AgentOrchestratorState.RUNNING],
      [AgentOrchestratorState.FAILED]: [AgentOrchestratorState.READY, AgentOrchestratorState.RUNNING],
    };

    const allowed = allowedTransitions[current] || [];
    if (!allowed.includes(target)) {
      throw new InvalidOrchestratorStateException("transition", current);
    }
  }
}
