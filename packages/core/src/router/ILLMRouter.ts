import { RouterRequest } from "./RouterRequest";
import { RouterResponse } from "./RouterResponse";
import { RouterSnapshot } from "./RouterSnapshot";
import { ModelDescriptor } from "./ModelDescriptor";

export interface ILLMRouter {
  registerModel(model: ModelDescriptor): void;
  unregisterModel(modelId: string): boolean;
  route(request: RouterRequest): Promise<RouterResponse>;
  snapshot(): RouterSnapshot;
}
