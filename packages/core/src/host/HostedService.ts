export interface HostedService {
  readonly id: string;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
}
