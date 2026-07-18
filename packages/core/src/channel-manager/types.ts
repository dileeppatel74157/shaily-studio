// ─── Channel Manager Exception Hierarchy ──────────────────────────────────────

export class ChannelManagerException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ChannelManagerValidationException extends ChannelManagerException {
  constructor(message: string) { super(message); }
}

export class DuplicateChannelException extends ChannelManagerException {
  constructor(id: string) {
    super(`Channel with ID "${id}" is already registered.`);
  }
}

export class DuplicateProviderException extends ChannelManagerException {
  constructor(provider: string) {
    super(`Provider "${provider}" is already registered.`);
  }
}

export class ChannelNotFoundException extends ChannelManagerException {
  constructor(id: string) {
    super(`Channel "${id}" not found in the channel registry.`);
  }
}

export class OAuthException extends ChannelManagerException {
  constructor(channelId: string, reason: string) {
    super(`OAuth failure for channel "${channelId}": ${reason}`);
  }
}

export class TokenExpiredException extends ChannelManagerException {
  constructor(channelId: string) {
    super(`OAuth token for channel "${channelId}" has expired. Re-authentication required.`);
  }
}

export class ProviderNotFoundException extends ChannelManagerException {
  constructor(provider: string) {
    super(`No provider registered for platform "${provider}".`);
  }
}

export class CapabilityMismatchException extends ChannelManagerException {
  constructor(provider: string, capability: string) {
    super(`Platform "${provider}" does not support capability "${capability}".`);
  }
}

export class QueueConflictException extends ChannelManagerException {
  constructor(itemId: string) {
    super(`Upload queue conflict: item "${itemId}" is already queued.`);
  }
}

export class ScheduleConflictException extends ChannelManagerException {
  constructor(channelId: string, time: string) {
    super(`Schedule conflict on channel "${channelId}" at time "${time}".`);
  }
}

export class InvalidChannelStateException extends ChannelManagerException {
  constructor(id: string, action: string, state: string) {
    super(`Cannot perform "${action}" on channel "${id}" in state "${state}".`);
  }
}

// ─── Deep Freeze Utility ──────────────────────────────────────────────────────

export function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  Object.freeze(obj);
  const typed = obj as unknown as Record<string, unknown>;
  Object.getOwnPropertyNames(typed).forEach((prop) => {
    if (prop === "context") return;
    if (
      Object.prototype.hasOwnProperty.call(typed, prop) &&
      typed[prop] !== null &&
      (typeof typed[prop] === "object" || typeof typed[prop] === "function") &&
      !Object.isFrozen(typed[prop])
    ) {
      deepFreeze(typed[prop]);
    }
  });
  return obj;
}
