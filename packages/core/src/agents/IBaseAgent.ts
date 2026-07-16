import { AgentState } from "./AgentState";
import { AgentSnapshot } from "./AgentSnapshot";

export interface IBaseAgent {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly state: AgentState;

  initialize(): Promise<void>;
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  execute(task?: unknown): Promise<unknown>;
  snapshot(): AgentSnapshot;

  sendMessage?(recipientId: string, content: string, type?: any): Promise<any>;
  broadcast?(content: string, recipientIds: ReadonlyArray<string>): Promise<void>;
  delegateTask?(delegateeId: string, taskTitle: string, taskDescription: string): Promise<any>;
  reply?(messageId: string, content: string): Promise<any>;
  receive?(): Promise<ReadonlyArray<any>>;
  heartbeat?(): Promise<void>;
  presence?(status: any): Promise<void>;
  conversationHistory?(conversationId: string): Promise<any>;
}
