import { CompositionSnapshot } from "./CompositionSnapshot";

export interface IServiceProvider {
  resolve<T>(token: string): T;
  tryResolve<T>(token: string): T | undefined;
  createScope(): IServiceProvider;
  dispose(): Promise<void>;
  snapshot(): CompositionSnapshot;
}
