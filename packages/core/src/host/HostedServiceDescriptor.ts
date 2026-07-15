import { HostedService } from "./HostedService";

export interface HostedServiceDescriptor {
  readonly id: string;
  readonly service: HostedService;
}
