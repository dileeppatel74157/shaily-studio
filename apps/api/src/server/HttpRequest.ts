import { HttpMethod } from "./HttpMethod";
import { ServerContext } from "./ServerContext";

export class HttpRequest {
  constructor(
    public readonly headers: Readonly<Record<string, string | string[] | undefined>>,
    public readonly params: Readonly<Record<string, string>>,
    public readonly query: Readonly<Record<string, string | string[] | undefined>>,
    public readonly body: any,
    public readonly method: HttpMethod,
    public readonly path: string,
    public readonly context: ServerContext
  ) {
    Object.freeze(this);
    Object.freeze(this.headers);
    Object.freeze(this.params);
    Object.freeze(this.query);
    if (body && typeof body === "object") {
      Object.freeze(body);
    }
  }
}
