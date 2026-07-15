import { HostedService } from "./HostedService";
import { HostSnapshot } from "./HostSnapshot";

export interface IHost {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  register(service: HostedService): Promise<void>;
  unregister(serviceId: string): Promise<void>;

  has(serviceId: string): boolean;
  get(serviceId: string): HostedService | undefined;
  list(): readonly HostedService[];

  snapshot(): HostSnapshot;
}
