import { MessageEnvelope } from "./MessageEnvelope";

export interface DeadLetterRecord {
  readonly envelope: MessageEnvelope;
  readonly reason: string;
  readonly failedAt: Date;
}

export class DeadLetterQueue {
  private readonly _records: DeadLetterRecord[] = [];

  public add(envelope: MessageEnvelope, reason: string): void {
    this._records.push(
      Object.freeze({
        envelope,
        reason,
        failedAt: new Date(),
      })
    );
  }

  public list(): readonly DeadLetterRecord[] {
    return Object.freeze([...this._records]);
  }
}
