import { IGateway } from "@shaily/core";
import { GatewayServer } from "./GatewayServer";
import { RouteDefinition } from "./RouteDefinition";
import { GatewayRequest } from "./GatewayRequest";
import { GatewayResponse } from "./GatewayResponse";
import { GatewaySnapshot } from "./GatewaySnapshot";
import { GatewayContext } from "./GatewayContext";
import { GatewayState } from "./GatewayState";
import { GatewayMiddleware } from "./GatewayMiddleware";

export class Gateway implements IGateway {

  private readonly _server: GatewayServer;

  constructor(
    public readonly context: GatewayContext,
    public readonly host: string,
    public readonly port: number
  ) {
    this._server = new GatewayServer(context, host, port);
    this.registerBuiltInRoutes();
  }

  public get state(): GatewayState {
    return this._server.state;
  }

  public async initialize(): Promise<void> {
    await this._server.initialize();
  }

  public async start(): Promise<void> {
    await this._server.start();
  }

  public async stop(): Promise<void> {
    await this._server.stop();
  }

  public registerRoute(route: RouteDefinition): void {
    this._server.registerRoute(route);
  }

  public unregisterRoute(path: string): boolean {
    const routes = this._server.snapshot().routes;
    let removed = false;
    for (const r of routes) {
      if (r.path === path) {
        if (this._server.unregisterRoute(r.method, path)) {
          removed = true;
        }
      }
    }
    return removed;
  }

  public registerMiddleware(middleware: GatewayMiddleware): void {
    this._server.registerMiddleware(middleware);
  }

  public async handle(request: GatewayRequest): Promise<GatewayResponse> {
    return await this._server.handle(request);
  }

  public snapshot(): GatewaySnapshot {
    return this._server.snapshot();
  }

  private registerBuiltInRoutes(): void {
    // 1. GET /health
    this.registerRoute({
      method: "GET",
      path: "/health",
      metadata: { builtIn: true },
      handler: async (req: any) => ({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: { status: "ok", timestamp: new Date().toISOString() },
      }),
    });

    // 2. GET /snapshot
    this.registerRoute({
      method: "GET",
      path: "/snapshot",
      metadata: { builtIn: true },
      handler: async (req: any) => ({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: this.snapshot(),
      }),
    });

    // 3. POST /orchestrator/execute
    this.registerRoute({
      method: "POST",
      path: "/orchestrator/execute",
      metadata: { builtIn: true },
      handler: async (req: any) => {
        const res = await this.context.orchestrator.execute(req.body);
        return {
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: res,
        };
      },
    });

    // 4. POST /router/route
    this.registerRoute({
      method: "POST",
      path: "/router/route",
      metadata: { builtIn: true },
      handler: async (req: any) => {
        const res = await this.context.router.route(req.body);
        return {
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: res,
        };
      },
    });

    // 5. POST /providers/:id
    this.registerRoute({
      method: "POST",
      path: "/providers/:id",
      metadata: { builtIn: true },
      handler: async (req: any) => {
        const res = await this.context.providers.execute(req.params.id, req.body);
        return {
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: res,
        };
      },
    });


    // 6. POST /agents/:id
    this.registerRoute({
      method: "POST",
      path: "/agents/:id",
      metadata: { builtIn: true },
      handler: async (req: any) => {
        const agent = this.context.agents.get(req.params.id);
        if (!agent) {
          return {
            status: 404,
            headers: { "Content-Type": "application/json" },
            body: {
              success: false,
              message: `Agent with ID "${req.params.id}" not found.`,
            },
          };
        }
        const res = await agent.execute(req.body);
        return {
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: res,
        };
      },
    });

    // 7. POST /workflow/:id
    this.registerRoute({
      method: "POST",
      path: "/workflow/:id",
      metadata: { builtIn: true },
      handler: async (req: any) => {
        const res = await this.context.workflow.execute(req.params.id);
        return {
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: res,
        };
      },
    });

    // 8. POST /tools/:id
    this.registerRoute({
      method: "POST",
      path: "/tools/:id",
      metadata: { builtIn: true },
      handler: async (req: any) => {
        const res = await this.context.tools.execute(req.params.id, req.body);
        return {
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: res,
        };
      },
    });

    // 9. POST /rag/query
    this.registerRoute({
      method: "POST",
      path: "/rag/query",
      metadata: { builtIn: true },
      handler: async (req: any) => {
        const res = await this.context.rag.retrieve(req.body);
        return {
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: res,
        };
      },
    });

    // 10. POST /prompts/render
    this.registerRoute({
      method: "POST",
      path: "/prompts/render",
      metadata: { builtIn: true },
      handler: async (req: any) => {
        const res = this.context.prompts.render(
          req.body.id,
          req.body.variables
        );
        return {
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: { rendered: res },
        };
      },
    });

    // 11. GET /knowledge/search
    this.registerRoute({
      method: "GET",
      path: "/knowledge/search",
      metadata: { builtIn: true },
      handler: async (req: any) => {
        const res = this.context.knowledge.search({
          keyword: req.query.keyword,
          exact: req.query.exact === "true",
          collection: req.query.collection,
        });
        return {
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: res,
        };
      },
    });

    // 12. POST /mcp
    this.registerRoute({
      method: "POST",
      path: "/mcp",
      metadata: { builtIn: true },
      handler: async (req: any) => {
        const res = await this.context.mcp.handle(req.body);
        return {
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: res,
        };
      },
    });

  }
}
