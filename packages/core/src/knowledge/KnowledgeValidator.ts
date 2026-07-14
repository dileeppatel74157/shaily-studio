import { KnowledgeDocument } from "./KnowledgeDocument";
import { KnowledgeChunk } from "./KnowledgeChunk";
import { KnowledgeMetadata } from "./KnowledgeMetadata";
import { KnowledgeValidationException } from "./types";

export class KnowledgeValidator {
  public validateDocument(doc: KnowledgeDocument): void {
    if (!doc.id || doc.id.trim() === "") {
      throw new KnowledgeValidationException("Document ID cannot be empty.");
    }
    if (!doc.title || doc.title.trim() === "") {
      throw new KnowledgeValidationException("Document Title cannot be empty.");
    }
    if (!doc.collection || doc.collection.trim() === "") {
      throw new KnowledgeValidationException("Document Collection cannot be empty.");
    }
    this.validateMetadata(doc.metadata);

    if (!doc.chunks || doc.chunks.length === 0) {
      throw new KnowledgeValidationException("Document must contain at least one chunk.");
    }

    const seenChunkIds = new Set<string>();
    for (const chunk of doc.chunks) {
      this.validateChunk(chunk, doc.id);
      if (seenChunkIds.has(chunk.id)) {
        throw new KnowledgeValidationException(
          `Duplicate chunk ID: "${chunk.id}" found in document.`
        );
      }
      seenChunkIds.add(chunk.id);
    }
  }

  public validateChunk(chunk: KnowledgeChunk, expectedDocId: string): void {
    if (!chunk.id || chunk.id.trim() === "") {
      throw new KnowledgeValidationException("Chunk ID cannot be empty.");
    }
    if (chunk.documentId !== expectedDocId) {
      throw new KnowledgeValidationException(
        `Chunk documentId "${chunk.documentId}" does not match document ID "${expectedDocId}".`
      );
    }
    if (!chunk.text || chunk.text.trim() === "") {
      throw new KnowledgeValidationException("Chunk text cannot be empty.");
    }
    if (chunk.index < 0) {
      throw new KnowledgeValidationException("Chunk index cannot be negative.");
    }
  }

  public validateMetadata(metadata: KnowledgeMetadata): void {
    if (metadata === null || metadata === undefined) {
      throw new KnowledgeValidationException("Metadata cannot be null or undefined.");
    }
    for (const key of Object.keys(metadata)) {
      this.validateJSONSafeValue(metadata[key], key);
    }
  }

  private validateJSONSafeValue(value: any, key: string): void {
    if (value === undefined) {
      throw new KnowledgeValidationException(
        `Metadata key "${key}" has undefined value, which is not JSON-safe.`
      );
    }
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (
          item !== null &&
          typeof item !== "string" &&
          typeof item !== "number" &&
          typeof item !== "boolean"
        ) {
          throw new KnowledgeValidationException(
            `Metadata key "${key}" contains array item of invalid JSON-safe type.`
          );
        }
      }
      return;
    }
    if (typeof value === "object") {
      try {
        const str = JSON.stringify(value);
        if (str === undefined) {
          throw new Error();
        }
      } catch (err) {
        throw new KnowledgeValidationException(
          `Metadata key "${key}" has non-serializable object value.`
        );
      }
      return;
    }
    throw new KnowledgeValidationException(
      `Metadata key "${key}" contains value of invalid JSON-safe type.`
    );
  }
}
