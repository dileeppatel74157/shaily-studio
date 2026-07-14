import { HttpRequest } from "./HttpRequest";
import { HttpResponse } from "./HttpResponse";

export type MiddlewareHandler = (
  req: HttpRequest,
  next: () => Promise<HttpResponse>
) => Promise<HttpResponse>;

export interface MiddlewareDefinition {
  readonly id: string;
  readonly handler: MiddlewareHandler;
  readonly metadata: Readonly<Record<string, any>>;
}
