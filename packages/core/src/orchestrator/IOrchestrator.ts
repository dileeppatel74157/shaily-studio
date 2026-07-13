import { OrchestratorRequest } from "./OrchestratorRequest";
import { OrchestratorResponse } from "./OrchestratorResponse";
import { OrchestratorSnapshot } from "./OrchestratorSnapshot";

export interface IOrchestrator {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  execute(request: OrchestratorRequest): Promise<OrchestratorResponse>;
  snapshot(): OrchestratorSnapshot;
}
