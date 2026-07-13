import { KernelState } from "./KernelState";
import { ServiceToken } from "./ServiceToken";
import { Version } from "./Version";

export interface KernelHealth {
  readonly kernelId: string;
  readonly version: Version;
  readonly state: KernelState;
  readonly environment: string;
  readonly bootTime: Date | null;
  readonly uptime: number;
  readonly registeredServiceCount: number;
  readonly isHealthy: boolean;
  readonly timestamp: Date;
}

export interface KernelStatus {
  readonly state: KernelState;
  readonly timestamp: Date;
  readonly kernelId: string;
}

export class KernelException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ServiceNotFoundException extends KernelException {
  constructor(token: ServiceToken<unknown> | string) {
    const name = typeof token === "string" ? token : token.description;
    super(`Service "${name}" was not found in the Kernel registry.`);
  }
}

export class ServiceAlreadyRegisteredException extends KernelException {
  constructor(token: ServiceToken<unknown> | string) {
    const name = typeof token === "string" ? token : token.description;
    super(`Service "${name}" has already been registered in the Kernel.`);
  }
}

export class InvalidKernelStateException extends KernelException {
  constructor(action: string, currentState: KernelState) {
    super(`Cannot perform "${action}" while Kernel is in "${currentState}" state.`);
  }
}
