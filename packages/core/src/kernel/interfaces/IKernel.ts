import { KernelModule } from "../types/KernelModule";
import { KernelSnapshot } from "../models/KernelSnapshot";

export interface IKernel {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  register(module: KernelModule): Promise<void>;
  unregister(moduleId: string): Promise<void>;

  has(moduleId: string): boolean;
  get(moduleId: string): KernelModule | undefined;
  list(): readonly KernelModule[];

  snapshot(): KernelSnapshot;
}
