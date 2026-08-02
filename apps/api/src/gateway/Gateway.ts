import {
  IGateway,
  ChannelManagerEngine,
  DatabaseBuilder,
  DatabaseProvider,
  PlatformProvider,
  ChannelManagerState,
  encrypt,
  decrypt
} from "@shaily/core";
import { GatewayServer } from "./GatewayServer";
import { RouteDefinition } from "./RouteDefinition";
import { GatewayRequest } from "./GatewayRequest";
import { GatewayResponse } from "./GatewayResponse";
import { GatewaySnapshot } from "./GatewaySnapshot";
import { GatewayContext } from "./GatewayContext";
import { GatewayState } from "./GatewayState";
import { GatewayMiddleware } from "./GatewayMiddleware";
import { google } from "googleapis";

  private readonly _server: GatewayServer;
  private _channelManager?: any;
  private _databaseEngine?: any;

  private async getDatabaseEngine(): Promise<any> {
    if (!this._databaseEngine) {
      const db = new DatabaseBuilder()
        .withContext(this.context)
        .withProvider(DatabaseProvider.POSTGRESQL)
        .withHost(process.env.POSTGRES_HOST || "localhost")
        .withPort(parseInt(process.env.POSTGRES_PORT || "5432", 10))
        .withDatabase(process.env.POSTGRES_DB || "shaily_studio_dev")
        .withUsername(process.env.POSTGRES_USER || "shaily_admin")
        .withPassword(process.env.POSTGRES_PASSWORD || "shaily_secure_password_123")
        .build();
      await db.initialize();
      await db.connect();
      this._databaseEngine = db;
    }
    return this._databaseEngine;
  }

  private async getChannelManager(): Promise<any> {
    if (!this._channelManager) {
      const db = await this.getDatabaseEngine();
      const ctx = {
        ...this.context,
        databaseEngine: db,
        eventBus: (this.context as any).eventBus
      };
      const cm = new ChannelManagerEngine(ctx);
      await cm.initialize();
      await cm.start();
      this._channelManager = cm;
    }
    return this._channelManager;
  }

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

    // --- YouTube OAuth Consent Screen ---
    this.registerRoute({
      method: "GET",
      path: "/api/channels/connect/youtube",
      metadata: { builtIn: false },
      handler: async (req: any) => {
        const oauth2Client = new google.auth.OAuth2(
          process.env.YOUTUBE_OAUTH_CLIENT_ID,
          process.env.YOUTUBE_OAUTH_CLIENT_SECRET,
          process.env.YOUTUBE_OAUTH_REDIRECT_URL
        );
        const scopes = [
          "https://www.googleapis.com/auth/youtube.upload",
          "https://www.googleapis.com/auth/youtube.readonly",
          "https://www.googleapis.com/auth/youtube.force-ssl",
          "https://www.googleapis.com/auth/userinfo.profile",
          "https://www.googleapis.com/auth/userinfo.email"
        ];
        const authUrl = oauth2Client.generateAuthUrl({
          access_type: "offline",
          scope: scopes,
          prompt: "consent"
        });
        return {
          status: 302,
          headers: { "Location": authUrl },
          body: { redirect: authUrl }
        };
      }
    });

    // --- YouTube OAuth Callback ---
    this.registerRoute({
      method: "GET",
      path: "/api/channels/oauth/callback",
      metadata: { builtIn: false },
      handler: async (req: any) => {
        const code = req.query.code;
        if (!code) {
          return {
            status: 400,
            headers: { "Content-Type": "application/json" },
            body: { success: false, error: "Missing authorization code" }
          };
        }

        try {
          const oauth2Client = new google.auth.OAuth2(
            process.env.YOUTUBE_OAUTH_CLIENT_ID,
            process.env.YOUTUBE_OAUTH_CLIENT_SECRET,
            process.env.YOUTUBE_OAUTH_REDIRECT_URL
          );
          const { tokens } = await oauth2Client.getToken(code);
          oauth2Client.setCredentials(tokens);

          const youtube = google.youtube({ version: "v3", auth: oauth2Client });
          const channelResponse = await youtube.channels.list({
            part: ["snippet", "statistics"],
            mine: true
          });
          const item = channelResponse.data.items?.[0];
          if (!item) {
            return {
              status: 404,
              headers: { "Content-Type": "application/json" },
              body: { success: false, error: "No YouTube channel found for credentials" }
            };
          }

          const channelId = item.id || "unknown-yt-channel";
          const channelName = item.snippet?.title || "YouTube Channel";

          const encryptedAccess = encrypt(tokens.access_token || "");
          const encryptedRefresh = tokens.refresh_token ? encrypt(tokens.refresh_token) : "";
          const expiresAt = new Date(tokens.expiry_date || (Date.now() + 3600 * 1000)).toISOString();
          const scopes = tokens.scope ? tokens.scope.split(" ") : [];

          // Connect channel in ChannelManagerEngine
          const cm = await this.getChannelManager();
          await cm.execute({
            id: `req-connect-${Date.now()}`,
            action: "CONNECT",
            provider: PlatformProvider.YOUTUBE,
            state: ChannelManagerState.INITIALIZED,
            timestamp: new Date(),
            payload: {
              accountId: channelId,
              displayName: channelName,
              accessToken: encryptedAccess,
              refreshToken: encryptedRefresh,
              expiresAt,
              scopes
            }
          });

          // Insert/Update DB channel_connections
          const db = await this.getDatabaseEngine();
          const qm = db.getQueryManager();
          await qm.execute({
            id: `db-conn-insert-${Date.now()}`,
            sql: `
              INSERT INTO channel_connections (id, platform, channel_name, display_name, status, connected_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT (id) DO UPDATE SET
                channel_name = EXCLUDED.channel_name,
                display_name = EXCLUDED.display_name,
                status = EXCLUDED.status,
                connected_at = EXCLUDED.connected_at
            `,
            parameters: [channelId, "YOUTUBE", channelName, channelName, "CONNECTED", new Date().toISOString()]
          });

          // Insert/Update DB oauth_credentials
          await qm.execute({
            id: `db-cred-insert-${Date.now()}`,
            sql: `
              INSERT INTO oauth_credentials (channel_id, access_token, refresh_token, token_type, expires_at, scopes, issued_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT (channel_id) DO UPDATE SET
                access_token = EXCLUDED.access_token,
                refresh_token = EXCLUDED.refresh_token,
                expires_at = EXCLUDED.expires_at,
                scopes = EXCLUDED.scopes,
                issued_at = EXCLUDED.issued_at
            `,
            parameters: [
              channelId,
              encryptedAccess,
              encryptedRefresh,
              tokens.token_type || "Bearer",
              expiresAt,
              tokens.scope || "",
              new Date().toISOString()
            ]
          });

          return {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: { success: true, channelId, channelName }
          };
        } catch (err: any) {
          return {
            status: 500,
            headers: { "Content-Type": "application/json" },
            body: { success: false, error: err.message }
          };
        }
      }
    });

    // --- List Active Connected Channels ---
    this.registerRoute({
      method: "GET",
      path: "/api/channels",
      metadata: { builtIn: false },
      handler: async (req: any) => {
        try {
          const db = await this.getDatabaseEngine();
          const res = await db.getQueryManager().execute({
            id: `db-channels-get-${Date.now()}`,
            sql: "SELECT id, platform, channel_name, display_name, connected_at, status FROM channel_connections WHERE status = 'CONNECTED'"
          });
          return {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: res.rows || []
          };
        } catch (err) {
          try {
            const cm = await this.getChannelManager();
            return {
              status: 200,
              headers: { "Content-Type": "application/json" },
              body: cm.listChannels()
            };
          } catch (cmErr: any) {
            return {
              status: 500,
              headers: { "Content-Type": "application/json" },
              body: { success: false, error: cmErr.message }
            };
          }
        }
      }
    });

    // --- Disconnect Channel ---
    this.registerRoute({
      method: "DELETE",
      path: "/api/channels/:id",
      metadata: { builtIn: false },
      handler: async (req: any) => {
        const channelId = req.params.id;
        if (!channelId) {
          return {
            status: 400,
            headers: { "Content-Type": "application/json" },
            body: { success: false, error: "Missing channel id" }
          };
        }

        try {
          // Disconnect in DB
          try {
            const db = await this.getDatabaseEngine();
            await db.getQueryManager().execute({
              id: `db-channel-delete-${Date.now()}`,
              sql: "UPDATE channel_connections SET status = 'DISCONNECTED' WHERE id = ?",
              parameters: [channelId]
            });
            await db.getQueryManager().execute({
              id: `db-cred-delete-${Date.now()}`,
              sql: "DELETE FROM oauth_credentials WHERE channel_id = ?",
              parameters: [channelId]
            });
          } catch (_) {}

          // Disconnect in ChannelManagerEngine
          try {
            const cm = await this.getChannelManager();
            await cm.execute({
              id: `req-disconnect-${Date.now()}`,
              action: "DISCONNECT",
              channelId,
              state: ChannelManagerState.INITIALIZED,
              timestamp: new Date()
            });
          } catch (_) {}

          return {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: { success: true }
          };
        } catch (err: any) {
          return {
            status: 500,
            headers: { "Content-Type": "application/json" },
            body: { success: false, error: err.message }
          };
        }
      }
    });

  }
}
