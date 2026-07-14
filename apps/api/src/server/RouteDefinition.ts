import { HttpMethod } from "./HttpMethod";
import { HttpRequest } from "./HttpRequest";
import { HttpResponse } from "./HttpResponse";

export interface RouteDefinition {
  readonly id: string;
  readonly path: string;
  readonly method: HttpMethod;
  readonly handler: (req: HttpRequest) => Promise<HttpResponse> | HttpResponse;
  readonly metadata: Readonly<Record<string, any>>;
}
