import { ToolCapability } from "./ToolCapability";

export interface ToolMetadata {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author: string;
  readonly capabilities: readonly ToolCapability[];
}
