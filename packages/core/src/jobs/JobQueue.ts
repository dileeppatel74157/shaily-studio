import { Job } from "./Job";

interface QueueEntry {
  job: Job;
  sequenceNumber: number;
}

export class JobQueue {
  private _entries: QueueEntry[] = [];
  private _nextSequenceNumber = 0;

  public enqueue(job: Job): void {
    job.queue();
    this._entries.push({
      job,
      sequenceNumber: this._nextSequenceNumber++,
    });
    this.sort();
  }

  public dequeue(): Job | undefined {
    const entry = this._entries.shift();
    return entry?.job;
  }

  public get size(): number {
    return this._entries.length;
  }

  public remove(jobId: string): boolean {
    const initialLength = this._entries.length;
    this._entries = this._entries.filter((entry) => entry.job.id !== jobId);
    return this._entries.length < initialLength;
  }

  public get(jobId: string): Job | undefined {
    return this._entries.find((entry) => entry.job.id === jobId)?.job;
  }

  public clear(): void {
    this._entries = [];
  }

  public getAll(): Job[] {
    return this._entries.map((entry) => entry.job);
  }

  private sort(): void {
    this._entries.sort((a, b) => {
      // Sort by priority descending (CRITICAL = 3, LOW = 0)
      if (b.job.priority !== a.job.priority) {
        return b.job.priority - a.job.priority;
      }
      // FIFO: sort by sequenceNumber ascending (lower sequenceNumber means submitted earlier)
      return a.sequenceNumber - b.sequenceNumber;
    });
  }
}
