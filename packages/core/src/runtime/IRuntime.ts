import { RuntimeSessionDescriptor } from "./RuntimeSessionDescriptor";
import { RuntimeSession } from "./RuntimeSession";
import { RuntimeSnapshot } from "./RuntimeSnapshot";

export interface IRuntime {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  createSession(
    descriptor: RuntimeSessionDescriptor
  ): Promise<RuntimeSession>;

  destroySession(
    sessionId: string
  ): Promise<void>;

  hasSession(
    sessionId: string
  ): boolean;

  getSession(
    sessionId: string
  ): RuntimeSession | undefined;

  listSessions(): readonly RuntimeSession[];

  snapshot(): RuntimeSnapshot;
}
