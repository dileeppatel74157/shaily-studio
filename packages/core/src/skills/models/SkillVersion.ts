export class SkillVersion {
  constructor(
    public readonly major: number,
    public readonly minor: number,
    public readonly patch: number,
    public readonly label?: string
  ) {}

  public static parse(versionStr: string): SkillVersion {
    const match = versionStr.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
    if (!match) {
      throw new Error(`Invalid version format: ${versionStr}`);
    }
    return new SkillVersion(
      parseInt(match[1], 10),
      parseInt(match[2], 10),
      parseInt(match[3], 10),
      match[4]
    );
  }

  public toString(): string {
    return `${this.major}.${this.minor}.${this.patch}${this.label ? `-${this.label}` : ""}`;
  }

  public isCompatibleWith(range: string): boolean {
    if (range === "*" || range === "any") return true;
    const cleanRange = range.replace(/[\^~>=]/g, "").trim();
    try {
      const other = SkillVersion.parse(cleanRange);
      if (range.startsWith("^")) {
        return this.major === other.major && this.compare(other) >= 0;
      }
      if (range.startsWith("~")) {
        return this.major === other.major && this.minor === other.minor && this.compare(other) >= 0;
      }
      if (range.startsWith(">=")) {
        return this.compare(other) >= 0;
      }
      return this.compare(other) === 0;
    } catch {
      return false;
    }
  }

  public compare(other: SkillVersion): number {
    if (this.major !== other.major) return this.major - other.major;
    if (this.minor !== other.minor) return this.minor - other.minor;
    if (this.patch !== other.patch) return this.patch - other.patch;
    return 0;
  }
}
