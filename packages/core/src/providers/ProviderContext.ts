import { ILogger } from "../logger/ILogger";

export interface ProviderContext {
  readonly env?: string;
  readonly namespace?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  // Backward compatibility fields
  readonly logger?: ILogger;
  readonly config?: any;
  readonly memoryStore?: any;
  readonly eventBus?: any;
}
