import { RuntimeSession } from "./RuntimeSession";
import { RuntimeValidationException } from "./types";

export class RuntimeSessionRegistry {
  private readonly _sessions = new Map<string, RuntimeSession>();

  public register(session: RuntimeSession): void {
    if (this._sessions.has(session.id)) {
      throw new RuntimeValidationException(`Session with ID "${session.id}" already exists`);
    }
    this._sessions.set(session.id, session);
  }

  public unregister(sessionId: string): void {
    if (!this._sessions.has(sessionId)) {
      throw new RuntimeValidationException(`Session with ID "${sessionId}" does not exist`);
    }
    this._sessions.delete(sessionId);
  }

  public has(sessionId: string): boolean {
    return this._sessions.has(sessionId);
  }

  public get(sessionId: string): RuntimeSession | undefined {
    return this._sessions.get(sessionId);
  }

  public list(): readonly RuntimeSession[] {
    return Array.from(this._sessions.values());
  }

  public clear(): void {
    this._sessions.clear();
  }
}
