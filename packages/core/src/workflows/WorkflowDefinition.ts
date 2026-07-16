import { WorkflowStep } from "./WorkflowStep";
import { WorkflowVariable } from "./WorkflowVariable";
import { WorkflowTrigger } from "./WorkflowTrigger";
import { WorkflowMetadata } from "./WorkflowMetadata";
import { WorkflowCapability } from "./WorkflowCapability";

export interface WorkflowDefinition {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly trigger?: WorkflowTrigger;
  readonly variables?: readonly WorkflowVariable[];
  readonly steps: readonly WorkflowStep[];
  readonly metadata?: WorkflowMetadata;
  readonly capabilities?: readonly WorkflowCapability[];
}
