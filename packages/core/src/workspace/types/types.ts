import { WorkspaceState } from "../models/WorkspaceState";

export class WorkspaceException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ProjectNotFoundException extends WorkspaceException {
  constructor(projectId: string) {
    super(`Project with ID "${projectId}" was not found.`);
  }
}

export class AssetNotFoundException extends WorkspaceException {
  constructor(assetId: string) {
    super(`Asset with ID "${assetId}" was not found.`);
  }
}

export class VersionException extends WorkspaceException {
  constructor(message: string) {
    super(message);
  }
}

export class BackupException extends WorkspaceException {
  constructor(message: string) {
    super(message);
  }
}

export class RestoreException extends WorkspaceException {
  constructor(message: string) {
    super(message);
  }
}

export class WorkspaceValidationException extends WorkspaceException {
  constructor(message: string) {
    super(message);
  }
}

export class InvalidWorkspaceStateException extends WorkspaceException {
  constructor(action: string, currentState: WorkspaceState) {
    super(`Cannot perform action "${action}" when workspace state is "${currentState}".`);
  }
}

/**
 * Deep freezes an object recursively to ensure immutability.
 */
function isPlainObjectOrArray(value: unknown): boolean {
  if (Array.isArray(value)) return true;
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
export function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  Object.freeze(obj);

  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = (obj as any)[prop];
    if (isPlainObjectOrArray(value) && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });
  return obj;
}
