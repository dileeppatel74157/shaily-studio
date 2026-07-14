import { PromptVariable } from "./PromptVariable";

export interface PromptTemplate {
  readonly content: string;
  readonly variables: readonly PromptVariable[];
}
