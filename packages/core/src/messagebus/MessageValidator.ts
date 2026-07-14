import { Message } from "./Message";
import { MessagePriority } from "./MessagePriority";
import { MessageValidationException } from "./types";

export class MessageValidator {
  public validateMessage(message: Message): void {
    if (!message) {
      throw new MessageValidationException(
        "Message cannot be null or undefined."
      );
    }
    if (!message.id || message.id.trim() === "") {
      throw new MessageValidationException("Message ID cannot be empty.");
    }
    if (!message.type || message.type.trim() === "") {
      throw new MessageValidationException("Message type cannot be empty.");
    }
  }

  public validatePriority(priority: any): void {
    if (!priority) {
      throw new MessageValidationException("Priority is required.");
    }
    if (!Object.values(MessagePriority).includes(priority)) {
      throw new MessageValidationException(
        `Invalid message priority: "${priority}".`
      );
    }
  }

  public validateHeaders(headers: Readonly<Record<string, string>>): void {
    if (headers === null || headers === undefined) {
      throw new MessageValidationException(
        "Headers cannot be null or undefined."
      );
    }
    for (const [key, value] of Object.entries(headers)) {
      if (!key || key.trim() === "") {
        throw new MessageValidationException("Header key cannot be empty.");
      }
      if (value === undefined || value === null) {
        throw new MessageValidationException(
          `Header value for key "${key}" cannot be null or undefined.`
        );
      }
    }
  }
}
