import { HostedService } from "./HostedService";
import { HostValidationException } from "./types";

export class HostedServiceRegistry {
  private readonly _services = new Map<string, HostedService>();

  public register(service: HostedService): void {
    if (this._services.has(service.id)) {
      throw new HostValidationException(`Service with ID "${service.id}" is already registered`);
    }
    this._services.set(service.id, service);
  }

  public unregister(serviceId: string): void {
    if (!this._services.has(serviceId)) {
      throw new HostValidationException(`Service with ID "${serviceId}" is not registered`);
    }
    this._services.delete(serviceId);
  }

  public has(serviceId: string): boolean {
    return this._services.has(serviceId);
  }

  public get(serviceId: string): HostedService | undefined {
    return this._services.get(serviceId);
  }

  public list(): readonly HostedService[] {
    return Array.from(this._services.values());
  }

  public clear(): void {
    this._services.clear();
  }
}
