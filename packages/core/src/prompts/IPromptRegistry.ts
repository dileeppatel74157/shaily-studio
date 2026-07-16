import { PromptTemplate } from "./PromptTemplate";
import { PromptExecution } from "./PromptExecution";
import { PromptSnapshot } from "./PromptSnapshot";

export interface IPromptRegistry {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  register(
    template: PromptTemplate
  ): Promise<void>;

  unregister(
    promptId: string
  ): Promise<void>;

  has(
    promptId: string
  ): boolean;

  get(
    promptId: string
  ): PromptTemplate | undefined;

  list(): readonly PromptTemplate[];

  render(
    promptId: string,
    variables?: Record<string, unknown>
  ): Promise<PromptExecution>;

  snapshot(): PromptSnapshot;
}
