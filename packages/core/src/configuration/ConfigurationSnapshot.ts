import { ConfigurationSchema } from "./ConfigurationSchema";
import { ConfigurationSection } from "./ConfigurationSection";

export interface ConfigurationSnapshot {
  readonly timestamp: Date;
  readonly schema: ConfigurationSchema;
  readonly sections: readonly ConfigurationSection[];
  readonly values: Readonly<Record<string, unknown>>;
  readonly providers: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
}
