import { ScheduledJob } from "./ScheduledJob";

export class SchedulerQueue {
  private _queue: { job: ScheduledJob; priority: number }[] = [];

  public push(job: ScheduledJob, priority: number): void {
    this._queue.push({ job, priority });
    this._queue.sort((a, b) => b.priority - a.priority);
  }

  public pop(): ScheduledJob | undefined {
    const item = this._queue.shift();
    return item?.job;
  }

  public getJobs(): readonly ScheduledJob[] {
    return this._queue.map((item) => item.job);
  }

  public has(jobId: string): boolean {
    return this._queue.some((item) => item.job.id === jobId);
  }

  public updateJobStatus(jobId: string, status: ScheduledJob["status"]): void {
    const item = this._queue.find((item) => item.job.id === jobId);
    if (item) {
      const updatedJob: ScheduledJob = {
        ...item.job,
        status,
      };
      item.job = updatedJob;
    }
  }

  public remove(jobId: string): boolean {
    const initialLength = this._queue.length;
    this._queue = this._queue.filter((item) => item.job.id !== jobId);
    return this._queue.length < initialLength;
  }

  public clear(): void {
    this._queue = [];
  }
}
