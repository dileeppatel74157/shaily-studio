import { TeamMember } from "./TeamMember";

export interface AgentTeam {
  readonly id: string;
  readonly name: string;
  readonly leaderId?: string;
  readonly members: ReadonlyArray<TeamMember>;
  readonly createdAt: Date;
}
