import { IBaseAgent } from "./IBaseAgent";
import { AgentContext } from "./AgentContext";
import { AgentSnapshot } from "./AgentSnapshot";
import { AgentRole } from "./AgentRole";
import { AgentCapability } from "./AgentCapability";
import { AgentGoal } from "./AgentGoal";
import { AgentProfile } from "./AgentProfile";
import { AgentConfiguration } from "./AgentConfiguration";

export interface IAgent extends IBaseAgent {
  readonly version: string;
  readonly role: AgentRole;
  readonly capabilities: ReadonlyArray<AgentCapability>;
  readonly goals: ReadonlyArray<AgentGoal>;
  readonly profile?: AgentProfile;
  readonly configuration?: AgentConfiguration;
  readonly metadata: Record<string, unknown>;
  readonly context: AgentContext;

  shutdown(): Promise<void>;
}
