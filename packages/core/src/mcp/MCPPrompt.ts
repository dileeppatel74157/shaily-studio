export interface MCPPromptArgument {
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
}

export interface MCPPrompt {
  readonly name: string;
  readonly description: string;
  readonly arguments?: readonly MCPPromptArgument[];
}
