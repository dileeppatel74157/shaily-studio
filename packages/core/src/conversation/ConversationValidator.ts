import { ConversationMessage } from "./ConversationMessage";
import { ConversationSearch } from "./ConversationSearch";
import { ConversationMetadata } from "./ConversationMetadata";
import { ConversationRole } from "./ConversationRole";
import { ConversationValidationException } from "./types";
import { ConversationContext } from "./ConversationContext";

export class ConversationValidator {
  public static validateContext(context: ConversationContext): void {
    if (!context) {
      throw new ConversationValidationException("ConversationContext cannot be null or undefined.");
    }
  }

  public static validateMessage(message: ConversationMessage): void {
    if (!message) {
      throw new ConversationValidationException("Message cannot be null or undefined.");
    }
    if (!message.id || !message.id.trim()) {
      throw new ConversationValidationException("Message ID cannot be empty.");
    }
    if (!message.content || !message.content.trim()) {
      throw new ConversationValidationException("Empty message content: Message content cannot be empty.");
    }
    if (!message.role) {
      throw new ConversationValidationException("Message role cannot be null or undefined.");
    }
    if (!Object.values(ConversationRole).includes(message.role)) {
      throw new ConversationValidationException(`Invalid roles: Message role "${message.role}" is invalid.`);
    }
    if (!message.timestamp || isNaN(message.timestamp.getTime())) {
      throw new ConversationValidationException("Invalid timestamps: Message timestamp must be a valid Date.");
    }
  }

  public static validateMetadata(metadata?: ConversationMetadata): void {
    if (!metadata) return;
    if (metadata.tags && metadata.tags.some(t => !t || !t.trim())) {
      throw new ConversationValidationException("Tags cannot contain empty strings.");
    }
  }

  public static validateSearch(search: ConversationSearch): void {
    if (!search) {
      throw new ConversationValidationException("ConversationSearch cannot be null or undefined.");
    }
    const hasQuery = !!search.query?.trim();
    const hasRoles = Array.isArray(search.roles) && search.roles.length > 0;
    const hasConversationIds = Array.isArray(search.conversationIds) && search.conversationIds.length > 0;
    const hasTags = Array.isArray(search.tags) && search.tags.length > 0;
    const hasStartDate = !!search.startDate;
    const hasEndDate = !!search.endDate;
    const hasSessions = Array.isArray(search.sessionIds) && search.sessionIds.length > 0;

    if (!hasQuery && !hasRoles && !hasConversationIds && !hasTags && !hasStartDate && !hasEndDate && !hasSessions) {
      throw new ConversationValidationException("Empty searches: At least one search filter must be specified.");
    }

    if (search.startDate && isNaN(search.startDate.getTime())) {
      throw new ConversationValidationException("Invalid timestamps: Invalid startDate.");
    }
    if (search.endDate && isNaN(search.endDate.getTime())) {
      throw new ConversationValidationException("Invalid timestamps: Invalid endDate.");
    }
    if (search.startDate && search.endDate && search.startDate > search.endDate) {
      throw new ConversationValidationException("Invalid timestamps: startDate cannot be after endDate.");
    }
  }
}
