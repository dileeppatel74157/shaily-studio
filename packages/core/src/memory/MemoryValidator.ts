import { InvalidMemoryException } from "./types";

export class MemoryValidator {
  public validateKey(key: string): void {
    if (!key || key.trim() === "") {
      throw new InvalidMemoryException("Key cannot be empty.");
    }
  }

  public validateNamespace(namespace: string): void {
    if (!namespace || namespace.trim() === "") {
      throw new InvalidMemoryException("Namespace cannot be empty.");
    }
  }

  public validateValue(value: unknown): void {
    if (value === undefined) {
      throw new InvalidMemoryException("Value cannot be undefined.");
    }
  }
}
