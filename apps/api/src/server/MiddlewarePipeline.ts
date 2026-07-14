import { MiddlewareDefinition } from "./MiddlewareDefinition";
import { HttpRequest } from "./HttpRequest";
import { HttpResponse } from "./HttpResponse";
import { ServerValidationException } from "./types";

export class MiddlewarePipeline {
  private readonly _middlewares: MiddlewareDefinition[] = [];

  public register(middleware: MiddlewareDefinition): void {
    const isDuplicate = this._middlewares.some((m) => m.id === middleware.id);
    if (isDuplicate) {
      throw new ServerValidationException(
        `Duplicate middleware registered with ID: ${middleware.id}`
      );
    }
    this._middlewares.push(middleware);
  }

  public async execute(
    req: HttpRequest,
    finalHandler: (req: HttpRequest) => Promise<HttpResponse>
  ): Promise<HttpResponse> {
    let index = 0;

    const next = async (currentReq: HttpRequest): Promise<HttpResponse> => {
      if (index < this._middlewares.length) {
        const middleware = this._middlewares[index++];
        return await middleware.handler(currentReq, () => next(currentReq));
      }
      return await finalHandler(currentReq);
    };

    return await next(req);
  }

  public snapshot(): readonly MiddlewareDefinition[] {
    return Object.freeze(
      this._middlewares.map((m) =>
        Object.freeze({
          id: m.id,
          handler: m.handler,
          metadata: Object.freeze({ ...m.metadata }),
        })
      )
    );
  }
}
