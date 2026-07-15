import { ReadinessCheck } from "./ReadinessCheck";
import { ReadinessReport } from "./ReadinessReport";
import { ReadinessStatus } from "./ReadinessResult";
import { ReadinessValidationException } from "./types";

export class ReadinessValidator {
  public static validateChecks(checks: readonly ReadinessCheck[]): void {
    const ids = new Set<string>();
    for (const check of checks) {
      if (!check) {
        throw new ReadinessValidationException("ReadinessCheck cannot be null.");
      }
      this.validateIdentifier(check.id, "ReadinessCheck ID");
      this.validateNonEmpty(check.name, "ReadinessCheck Name");
      if (ids.has(check.id)) {
        throw new ReadinessValidationException(`Duplicate check ID detected: "${check.id}".`);
      }
      ids.add(check.id);
    }
  }

  public static validateReport(report: ReadinessReport): void {
    if (!report) {
      throw new ReadinessValidationException("Report cannot be null.");
    }
    if (!report.overallStatus) {
      throw new ReadinessValidationException("Report overallStatus must be defined.");
    }
    for (const checkResult of report.checks) {
      if (!Object.values(ReadinessStatus).includes(checkResult.status)) {
        throw new ReadinessValidationException(`Invalid check status value: "${checkResult.status}".`);
      }
    }
  }

  public static validateMetadata(metadata: Record<string, unknown>): void {
    if (!metadata) {
      throw new ReadinessValidationException("Metadata cannot be null.");
    }
    for (const [key, val] of Object.entries(metadata)) {
      this.validateIdentifier(key, "Metadata Key");
      if (val === null || val === undefined || (typeof val === "string" && val.trim() === "")) {
        throw new ReadinessValidationException(`Metadata value for key "${key}" cannot be empty.`);
      }
    }
  }

  public static validateIdentifier(id: string, name: string): void {
    if (!id || id.trim() === "") {
      throw new ReadinessValidationException(`${name} identifier cannot be empty.`);
    }
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(id)) {
      throw new ReadinessValidationException(
        `${name} identifier "${id}" must contain only alphanumeric characters, underscores, dashes, or dots.`
      );
    }
  }

  public static validateNonEmpty(val: string, name: string): void {
    if (val === null || val === undefined || (typeof val === "string" && val.trim() === "")) {
      throw new ReadinessValidationException(`${name} cannot be empty.`);
    }
  }
}
