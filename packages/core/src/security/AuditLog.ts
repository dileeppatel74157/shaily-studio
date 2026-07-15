import { AuditEvent } from "./AuditEvent";

export class AuditLog {
  private readonly _events: AuditEvent[] = [];

  public log(event: AuditEvent): void {
    this._events.push(event);
  }

  public getEvents(): readonly AuditEvent[] {
    return [...this._events];
  }

  public clear(): void {
    this._events.length = 0;
  }
}
