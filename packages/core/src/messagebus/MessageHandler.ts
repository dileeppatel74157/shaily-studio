import { MessageEnvelope } from "./MessageEnvelope";

export type MessageHandler = (
  envelope: MessageEnvelope
) => Promise<void> | void;
