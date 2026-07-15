import { StorageBucket } from "./StorageBucket";
import { StorageObject } from "./StorageObject";
import { StorageContext } from "./StorageContext";
import { StorageValidationException } from "./types";

export class StorageValidator {
  private static readonly ID_REGEX = /^[a-zA-Z0-9_.-]+$/;

  public static validateIdentifier(id: string, name: string): void {
    if (!id || typeof id !== "string" || id.trim() === "") {
      throw new StorageValidationException(`${name} identifier must be a non-empty string`);
    }
    if (!this.ID_REGEX.test(id)) {
      throw new StorageValidationException(
        `${name} identifier "${id}" contains invalid characters. Only alphanumeric, dots, dashes, and underscores are allowed.`
      );
    }
  }

  public static validateContext(context: StorageContext): void {
    if (!context) {
      throw new StorageValidationException("StorageContext cannot be null or undefined");
    }
    this.validateIdentifier(context.env, "Context environment (env)");
    this.validateIdentifier(context.namespace, "Context namespace");
  }

  public static validateBucket(bucket: StorageBucket): void {
    if (!bucket) {
      throw new StorageValidationException("Bucket cannot be null or undefined");
    }
    this.validateIdentifier(bucket.id, "Bucket ID");
    if (!bucket.name || typeof bucket.name !== "string" || bucket.name.trim() === "") {
      throw new StorageValidationException("Bucket name must be a non-empty string");
    }
  }

  public static validateObject(object: StorageObject): void {
    if (!object) {
      throw new StorageValidationException("Object cannot be null or undefined");
    }
    this.validateIdentifier(object.id, "Object ID");
    this.validateIdentifier(object.bucketId, "Object bucket ID");

    if (object.content === undefined || object.content === null) {
      throw new StorageValidationException("Object content is required");
    }

    if (!object.metadata) {
      throw new StorageValidationException("Object metadata is required");
    }

    if (typeof object.metadata.size !== "number" || object.metadata.size < 0 || isNaN(object.metadata.size)) {
      throw new StorageValidationException("Object metadata size must be a non-negative number");
    }

    if (!object.metadata.created || !(object.metadata.created instanceof Date) || isNaN(object.metadata.created.getTime())) {
      throw new StorageValidationException("Object metadata created Date is invalid");
    }

    if (!object.metadata.updated || !(object.metadata.updated instanceof Date) || isNaN(object.metadata.updated.getTime())) {
      throw new StorageValidationException("Object metadata updated Date is invalid");
    }
  }
}
