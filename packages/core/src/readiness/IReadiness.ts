import { ReadinessReport } from "./ReadinessReport";
import { ReadinessSnapshot } from "./ReadinessSnapshot";

export interface IReadiness {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  runChecks(): Promise<ReadinessReport>;
  snapshot(): ReadinessSnapshot;
}
