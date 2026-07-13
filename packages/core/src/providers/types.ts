import { ProviderSnapshot } from "./ProviderSnapshot";

export class ProviderException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidProviderStateException extends ProviderException {
  constructor(providerId: string, action: string, currentState: string) {
    super(
      `Cannot perform "${action}" on provider "${providerId}" because it is currently in state "${currentState}".`
    );
  }
}

export class ProviderValidationException extends ProviderException {
  constructor(message: string) {
    super(message);
  }
}

export interface ProviderRegistrySnapshot {
  readonly timestamp: Date;
  readonly count: number;
  readonly providers: ReadonlyArray<ProviderSnapshot>;
}
