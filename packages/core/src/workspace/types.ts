import { WorkspaceState } from "./WorkspaceState";

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
export function deepFreeze<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj !== "object" && typeof obj !== "function") {
    return obj;
  }

  // Freeze self
  Object.freeze(obj);

  // Freeze properties
  const propNames = Object.getOwnPropertyNames(obj);
  for (const name of propNames) {
    const value = (obj as any)[name];
    if (
      value !== null &&
      value !== undefined &&
      (typeof value === "object" || typeof value === "function") &&
      !Object.isFrozen(value)
    ) {
      deepFreeze(value);
    }
  }

  return obj;
}
