import { AgentSnapshot } from "./AgentSnapshot";

export class AgentException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidAgentStateException extends AgentException {
  constructor(agentId: string, action: string, currentState: string) {
    super(
      `Cannot perform "${action}" on agent "${agentId}" because it is currently in state "${currentState}".`
    );
  }
}

export interface AgentRegistrySnapshot {
  readonly timestamp: Date;
  readonly count: number;
  readonly agents: ReadonlyArray<AgentSnapshot>;
}
