import { KernelState } from "./KernelState";

export interface KernelHealth {
  state: KernelState;
  uptime: number; // Uptime in milliseconds
  version: string;
  environment: string;
  registeredServiceCount: number;
}

export class KernelException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ServiceNotFoundException extends KernelException {
  constructor(serviceName: string) {
    super(`Service "${serviceName}" was not found in the Kernel registry.`);
  }
}

export class ServiceAlreadyRegisteredException extends KernelException {
  constructor(serviceName: string) {
    super(`Service "${serviceName}" has already been registered in the Kernel.`);
  }
}

export class InvalidKernelStateException extends KernelException {
  constructor(action: string, currentState: KernelState) {
    super(`Cannot perform "${action}" while Kernel is in "${currentState}" state.`);
  }
}
