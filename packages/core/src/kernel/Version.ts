export class Version {
  public readonly major: number;
  public readonly minor: number;
  public readonly patch: number;
  public readonly label?: string;
  public readonly build?: string;

  constructor(major: number, minor: number, patch: number, label?: string, build?: string) {
    this.major = major;
    this.minor = minor;
    this.patch = patch;
    this.label = label;
    this.build = build;
  }

  public static parse(versionStr: string): Version {
    const regex =
      /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    const match = versionStr.match(regex);
    if (!match) {
      throw new Error(
        `Invalid version format: "${versionStr}". Must follow SemVer pattern (e.g., 1.0.0 or 1.0.0-alpha).`
      );
    }
    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);
    const patch = parseInt(match[3], 10);
    const label = match[4];
    const build = match[5];
    return new Version(major, minor, patch, label, build);
  }

  public toString(): string {
    let result = `${this.major}.${this.minor}.${this.patch}`;
    if (this.label) {
      result += `-${this.label}`;
    }
    if (this.build) {
      result += `+${this.build}`;
    }
    return result;
  }

  public compare(other: Version): number {
    if (this.major !== other.major) return this.major - other.major;
    if (this.minor !== other.minor) return this.minor - other.minor;
    if (this.patch !== other.patch) return this.patch - other.patch;

    if (this.label && !other.label) return -1;
    if (!this.label && other.label) return 1;
    if (this.label && other.label) {
      return this.label.localeCompare(other.label);
    }

    return 0;
  }

  public equals(other: Version): boolean {
    return this.compare(other) === 0 && this.build === other.build;
  }
}
