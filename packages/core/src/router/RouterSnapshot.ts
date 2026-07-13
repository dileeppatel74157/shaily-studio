import { ModelDescriptor } from "./ModelDescriptor";

export interface RouterSnapshot {
  readonly timestamp: Date;
  readonly defaultStrategy: string;
  readonly registeredModelsCount: number;
  readonly models: ReadonlyArray<ModelDescriptor>;
}
