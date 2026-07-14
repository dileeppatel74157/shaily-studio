export interface PromptMetadata {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly author: string;
  readonly [key: string]: any;
}
