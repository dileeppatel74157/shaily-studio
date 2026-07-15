import { IPlatform } from "../platform/IPlatform";

export interface ReadinessContext {
  readonly env: string;
  readonly namespace: string;
  readonly platform: IPlatform;
  readonly metadata: Readonly<Record<string, unknown>>;
}
