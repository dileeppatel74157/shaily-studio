import { PluginState } from "./PluginState";
import { PluginContext } from "./PluginContext";

export class PluginException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidPluginStateException extends PluginException {
  constructor(action: string, currentState: PluginState) {
    super(`Cannot perform "${action}" because Plugin is in state "${currentState}".`);
  }
}

export class PluginValidationException extends PluginException {
  constructor(message: string) {
    super(message);
  }
}

export interface IPluginLifecycle {
  initialize(context: PluginContext): Promise<void>;
  start(context: PluginContext): Promise<void>;
  stop(context: PluginContext): Promise<void>;
}
