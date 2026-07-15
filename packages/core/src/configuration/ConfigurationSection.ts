import { ConfigurationValue } from "./ConfigurationValue";

export interface ConfigurationSection {
  readonly path: string;
  readonly values: readonly ConfigurationValue[];
  readonly subsections: readonly ConfigurationSection[];
}
