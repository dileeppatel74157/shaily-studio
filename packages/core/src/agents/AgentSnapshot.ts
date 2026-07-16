import { AgentState } from "./AgentState";
import { AgentRole } from "./AgentRole";
import { AgentGoal } from "./AgentGoal";
import { AgentProfile } from "./AgentProfile";
import { AgentConfiguration } from "./AgentConfiguration";

export interface AgentSnapshot {
  readonly id: string;
  readonly name: string;
  readonly role: AgentRole;
  readonly version: string;
  readonly description: string;
  readonly state: AgentState;
  readonly capabilities: ReadonlyArray<string>;
  readonly goals: ReadonlyArray<AgentGoal>;
  readonly profile?: AgentProfile;
  readonly configuration?: AgentConfiguration;
  readonly metadata: Record<string, unknown>;
  readonly timestamp: Date;
}
