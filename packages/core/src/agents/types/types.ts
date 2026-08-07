import { AgentSnapshot } from "../models/AgentSnapshot";

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

function isPlainObjectOrArray(value: unknown): boolean {
  if (Array.isArray(value)) return true;
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
export function deepFreeze<T>(obj: any): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  Object.freeze(obj);

  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = (obj as any)[prop];
    if (isPlainObjectOrArray(value) && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });
  return obj;
}
