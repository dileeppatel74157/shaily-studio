export class MemorySerializer {
  /**
   * Deep clone a value using standard JSON parsing.
   */
  public clone<T>(value: T): T {
    if (value === undefined) {
      return undefined as any;
    }
    return JSON.parse(JSON.stringify(value));
  }

  /**
   * Recursively deep freeze an object.
   */
  public freeze<T>(value: T): T {
    if (value === null || typeof value !== "object") {
      return value;
    }

    const propNames = Reflect.ownKeys(value);

    for (const name of propNames) {
      const valueProp = (value as any)[name];
      if (valueProp !== null && typeof valueProp === "object") {
        this.freeze(valueProp);
      }
    }

    return Object.freeze(value);
  }

  /**
   * Serialize a value to a JSON string.
   */
  public serialize<T>(value: T): string {
    return JSON.stringify(value);
  }

  /**
   * Deserialize a value from a JSON string.
   */
  public deserialize<T>(serialized: string): T {
    return JSON.parse(serialized);
  }
}
