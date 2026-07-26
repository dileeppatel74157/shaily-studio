import { RuntimeSessionDescriptor } from "../models/RuntimeSessionDescriptor";
import { RuntimeSession } from "../models/RuntimeSession";
import { RuntimeSnapshot } from "../models/RuntimeSnapshot";

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
