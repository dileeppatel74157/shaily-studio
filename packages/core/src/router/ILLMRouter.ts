import { RouterRequest } from "./RouterRequest";
import { RouterResponse } from "./RouterResponse";
import { RouterSnapshot } from "./RouterSnapshot";
import { ModelDescriptor } from "./ModelDescriptor";
import { ProviderResponseChunk } from "../providers/ProviderResponse";

export interface ILLMRouter {
  registerModel(model: ModelDescriptor): void;
  unregisterModel(modelId: string): boolean;
  route(request: RouterRequest): Promise<RouterResponse>;
  routeStream(request: RouterRequest): AsyncGenerator<ProviderResponseChunk>;
  snapshot(): RouterSnapshot;
}
