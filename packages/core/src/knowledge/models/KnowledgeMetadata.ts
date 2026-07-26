export type JSONSafeValue =
  | string
  | number
  | boolean
  | null
  | readonly (string | number | boolean | null)[]
  | { readonly [key: string]: any };

export interface KnowledgeMetadata {
  readonly [key: string]: JSONSafeValue;
}
