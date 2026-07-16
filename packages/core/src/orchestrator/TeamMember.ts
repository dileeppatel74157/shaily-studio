import { TeamRole } from "./TeamRole";

export interface TeamMember {
  readonly agentId: string;
  readonly role: TeamRole;
  readonly capabilities: ReadonlyArray<string>;
  readonly joinedAt: Date;
}
