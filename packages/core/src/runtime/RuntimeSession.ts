export interface RuntimeSession {
  readonly id: string;
  readonly createdAt: Date;
  readonly state: "ACTIVE" | "INACTIVE" | "TERMINATED";
  readonly metadata: Readonly<Record<string, unknown>>;
}
