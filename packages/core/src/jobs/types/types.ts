export class JobEngineException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidJobStateException extends JobEngineException {
  constructor(jobId: string, action: string, currentStatus: string) {
    super(
      `Cannot perform "${action}" on job "${jobId}" because its status is currently "${currentStatus}".`
    );
  }
}

export class JobEngineNotRunningException extends JobEngineException {
  constructor(action: string, currentState: string) {
    super(`Cannot perform "${action}" because the Job Engine is currently "${currentState}".`);
  }
}
