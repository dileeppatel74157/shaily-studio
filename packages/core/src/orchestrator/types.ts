export class OrchestratorException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidOrchestratorStateException extends OrchestratorException {
  constructor(action: string, currentState: string) {
    super(`Cannot perform "${action}" because AI Orchestrator is in state "${currentState}".`);
  }
}

export class OrchestratorValidationException extends OrchestratorException {
  constructor(message: string) {
    super(message);
  }
}
