import { MessageEnvelope } from "./MessageEnvelope";
import { MessagePriority } from "./MessagePriority";

export class MessageQueue {
  private _envelopes: MessageEnvelope[] = [];

  public enqueue(envelope: MessageEnvelope): void {
    this._envelopes.push(envelope);
    this.sort();
  }

  public dequeue(): MessageEnvelope | undefined {
    return this._envelopes.shift();
  }

  public peek(): MessageEnvelope | undefined {
    return this._envelopes[0];
  }

  public get size(): number {
    return this._envelopes.length;
  }

  public list(): readonly MessageEnvelope[] {
    return Object.freeze([...this._envelopes]);
  }

  private sort(): void {
    const priorityWeights: Record<MessagePriority, number> = {
      [MessagePriority.CRITICAL]: 4,
      [MessagePriority.HIGH]: 3,
      [MessagePriority.NORMAL]: 2,
      [MessagePriority.LOW]: 1,
    };

    this._envelopes.sort((a, b) => {
      const weightA = priorityWeights[a.priority] || 2;
      const weightB = priorityWeights[b.priority] || 2;
      if (weightA !== weightB) {
        return weightB - weightA;
      }
      return a.timestamp.getTime() - b.timestamp.getTime();
    });
  }
}
