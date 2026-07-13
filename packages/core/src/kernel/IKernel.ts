import { KernelState } from "./KernelState";
import { KernelHealth } from "./types";

export interface IKernel {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  register<T>(name: string, service: T): void;
  resolve<T>(name: string): T;
  health(): KernelHealth;
  status(): KernelState;
}
