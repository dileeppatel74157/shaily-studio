import { Job } from "./Job";
import { JobEngineSnapshot } from "./JobSnapshot";

export interface IJobEngine {
  submit(job: Job): Promise<void>;
  cancel(jobId: string): Promise<boolean>;
  get(jobId: string): Job | undefined;
  has(jobId: string): boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  snapshot(): JobEngineSnapshot;
}
