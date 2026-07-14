import { PromptValidationException } from "./types";

export class PromptVersion {
  constructor(
    public readonly major: number,
    public readonly minor: number,
    public readonly patch: number
  ) {
    Object.freeze(this);
  }

  public static parse(versionStr: string): PromptVersion {
    if (!versionStr || versionStr.trim() === "") {
      throw new PromptValidationException("Version string cannot be empty.");
    }
    const parts = versionStr.split(".");
    if (parts.length !== 3) {
      throw new PromptValidationException(
        `Invalid version format: "${versionStr}". Expected major.minor.patch format.`
      );
    }
    const major = parseInt(parts[0], 10);
    const minor = parseInt(parts[1], 10);
    const patch = parseInt(parts[2], 10);

    if (
      isNaN(major) ||
      isNaN(minor) ||
      isNaN(patch) ||
      major < 0 ||
      minor < 0 ||
      patch < 0
    ) {
      throw new PromptValidationException(`Invalid semantic version: "${versionStr}"`);
    }

    return new PromptVersion(major, minor, patch);
  }

  public toString(): string {
    return `${this.major}.${this.minor}.${this.patch}`;
  }
}
