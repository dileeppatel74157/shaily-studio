import { AgentContext } from "../models/AgentContext";

export interface AgentLifecycle {
  initialize(context: AgentContext): Promise<void>;
  execute(context: AgentContext, input?: unknown): Promise<unknown>;
  shutdown(context: AgentContext): Promise<void>;
}
