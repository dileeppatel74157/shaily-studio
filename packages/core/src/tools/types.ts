import { ToolState } from "./ToolState";
import { ToolContext } from "./ToolContext";
import { ToolRequest } from "./ToolRequest";
import { ToolResponse } from "./ToolResponse";

export class ToolException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidToolStateException extends ToolException {
  constructor(action: string, currentState: ToolState) {
    super(`Cannot perform "${action}" because Tool is in state "${currentState}".`);
  }
}

export class ToolValidationException extends ToolException {
  constructor(message: string) {
    super(message);
  }
}

export interface IToolHandler {
  initialize?(context: ToolContext): Promise<void>;
  execute(request: ToolRequest, context: ToolContext): Promise<ToolResponse> | ToolResponse;
  shutdown?(context: ToolContext): Promise<void>;
}

export function deepFreeze<T>(obj: any): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    if (
      obj.hasOwnProperty(prop) &&
      obj[prop] !== null &&
      (typeof obj[prop] === "object" || typeof obj[prop] === "function") &&
      !Object.isFrozen(obj[prop])
    ) {
      deepFreeze(obj[prop]);
    }
  });
  return obj;
}
