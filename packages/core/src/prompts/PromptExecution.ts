export interface PromptExecution {
  readonly promptId: string;
  readonly version: string;
  readonly systemPrompt?: string;
  readonly developerPrompt?: string;
  readonly userPrompt?: string;
  readonly variables: Readonly<Record<string, any>>;
  readonly renderedAt: Date;
}
