import { ToolState } from "./ToolState";
import { ToolMetadata } from "./ToolMetadata";

export interface ToolSnapshot {
  readonly id: string;
  readonly state: ToolState;
  readonly metadata: ToolMetadata;
  readonly timestamp: Date;
}
