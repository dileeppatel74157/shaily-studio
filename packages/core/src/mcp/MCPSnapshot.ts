export interface MCPSnapshot {
  readonly state: string;
  readonly toolsCount: number;
  readonly promptsCount: number;
  readonly resourcesCount: number;
  readonly timestamp: Date;
  readonly metadata: Readonly<Record<string, any>>;
}
