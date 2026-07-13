import { KernelState } from "./KernelState";
import { ServiceToken } from "./ServiceToken";
import { KernelHealth, KernelStatus } from "./types";

export interface IKernel {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  register<T>(token: ServiceToken<T>, service: T): void;
  resolve<T>(token: ServiceToken<T>): T;
  health(): KernelHealth;
  status(): KernelStatus;
}
