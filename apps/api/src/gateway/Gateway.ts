import * as fs from "node:fs";
import * as path from "node:path";
import {
  IGateway,
  PlatformProvider,
  ChannelManagerState,
  encrypt
} from "@shaily/core/api-gateway";
import { GatewayServer } from "./GatewayServer";
import { RouteDefinition } from "./RouteDefinition";
import { GatewayRequest } from "./GatewayRequest";
import { GatewayResponse } from "./GatewayResponse";
import { GatewaySnapshot } from "./GatewaySnapshot";
import { GatewayContext } from "./GatewayContext";
import { GatewayState } from "./GatewayState";
import { GatewayMiddleware } from "./GatewayMiddleware";
import { google } from "googleapis";
import { createClient } from "redis";
import { AuthMiddleware } from "./AuthMiddleware";
import { JWT } from "./JWT";

export class Gateway implements IGateway {
  private readonly _server: GatewayServer;
  private _channelManager?: any;
  private _databaseEngine?: any;
  private _redisClient: any = null;

  private async getRedisClient(): Promise<any> {
    if (!this._redisClient) {
      const url = process.env.REDIS_URL || "redis://localhost:6379/0";
      const client = createClient({ url });
      client.on("error", (err: any) => console.error("Redis Client Error", err));
      await client.connect();
      this._redisClient = client;
    }
    return this._redisClient;
  }

  private async getDatabaseEngine(): Promise<any> {
    return (this.context as any).databaseEngine;
  }

  private async getChannelManager(): Promise<any> {
    return (this.context as any).channelManager;
  }

  private async getContentPipelineEngine(): Promise<any> {
    return (this.context as any).contentPipelineEngine;
  }

  constructor(
    public readonly context: GatewayContext,
    public readonly host: string,
    public readonly port: number
  ) {
    this._server = new GatewayServer(context, host, port);
    this.registerMiddleware(new AuthMiddleware());
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
    const healthHandler = async (req: any) => {
      const db = await this.getDatabaseEngine();
      const dbState = db ? db.getState() : "UNKNOWN";
      const obs = (this.context as any).observabilityEngine;
      const obsSnapshot = obs ? (typeof obs.snapshot === "function" ? obs.snapshot() : (typeof obs.getSnapshot === "function" ? obs.getSnapshot() : null)) : null;

      return {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: {
          status: "healthy",
          timestamp: new Date().toISOString(),
          database: {
            provider: db ? db.getProviderManager().getActiveProvider() : "NONE",
            state: dbState
          },
          observability: obsSnapshot
        }
      };
    };

    this.registerRoute({
      method: "GET",
      path: "/health",
      metadata: { builtIn: true },
      handler: healthHandler,
    });

    this.registerRoute({
      method: "GET",
      path: "/api/health",
      metadata: { builtIn: true },
      handler: healthHandler,
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
            params: [channelId, "YOUTUBE", channelName, channelName, "CONNECTED", new Date().toISOString()]
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
            params: [
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
              params: [channelId]
            });
            await db.getQueryManager().execute({
              id: `db-cred-delete-${Date.now()}`,
              sql: "DELETE FROM oauth_credentials WHERE channel_id = ?",
              params: [channelId]
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

    // --- GET /api/tasks ---
    this.registerRoute({
      method: "GET",
      path: "/api/tasks",
      metadata: { builtIn: false },
      handler: async (req: any) => {
        try {
          const db = await this.getDatabaseEngine();
          const result = await db.getQueryManager().execute({
            id: `db-tasks-get-${Date.now()}`,
            sql: "SELECT id, status, prompt, agent_id, input_data, error, created_at, updated_at FROM tasks ORDER BY created_at DESC"
          });

          const tasks = (result.rows || []).map((row: any) => {
            let videoUrl: string | undefined;
            if (row.status === "completed" && row.input_data) {
              try {
                const data = JSON.parse(row.input_data);
                const rawUrl = data.videoFileUrl || data.renderedFileUrl || data.outputPath;
                if (rawUrl) {
                  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
                    videoUrl = rawUrl;
                  } else {
                    const cleanPath = rawUrl.replace(/^file:\/\/\/?/, "");
                    const filename = path.basename(cleanPath);
                    const protocol = req.headers["x-forwarded-proto"] || "http";
                    const host = req.headers["host"] || "localhost:8000";
                    const baseUrl = process.env.NEXT_PUBLIC_API_URL || `${protocol}://${host}`;
                    videoUrl = `${baseUrl}/api/internal/download-render/${filename}`;
                  }
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }

            return {
              id: row.id,
              status: row.status,
              prompt: row.prompt,
              agent_id: row.agent_id,
              error: row.error,
              videoUrl,
              created_at: row.created_at,
              updated_at: row.updated_at
            };
          });

          return {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: tasks
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

    // --- POST /api/tasks ---
    this.registerRoute({
      method: "POST",
      path: "/api/tasks",
      metadata: { builtIn: false },
      handler: async (req: any) => {
        const { agent_id, prompt, task_type } = req.body || {};
        if (!prompt) {
          return {
            status: 400,
            headers: { "Content-Type": "application/json" },
            body: { success: false, error: "Missing required parameter: prompt" }
          };
        }
        try {
          const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const db = await this.getDatabaseEngine();
          
          // Insert task in DB
          await db.getQueryManager().execute({
            id: `db-task-insert-${Date.now()}`,
            sql: "INSERT INTO tasks (id, status, prompt, agent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            params: [taskId, "pending", prompt, agent_id || "default", new Date().toISOString(), new Date().toISOString()]
          });

          // Publish task to Redis
          const redisClient = await this.getRedisClient();
          const taskPayload = {
            id: taskId,
            agent_id: agent_id || "default",
            prompt,
            task_type: task_type || "heavy_ai"
          };
          await redisClient.lPush("shaily:tasks", JSON.stringify(taskPayload));

          return {
            status: 201,
            headers: { "Content-Type": "application/json" },
            body: { success: true, taskId, status: "pending" }
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

    // --- GET /api/memory ---
    this.registerRoute({
      method: "GET",
      path: "/api/memory",
      metadata: { builtIn: false },
      handler: async (req: any) => {
        try {
          const memoryEngine = (this.context as any).memoryEngine;
          if (!memoryEngine) {
            return {
              status: 500,
              headers: { "Content-Type": "application/json" },
              body: { success: false, error: "MemoryEngine not registered on context" }
            };
          }
          const criteria = {
            query: req.query.query,
            agentId: req.query.agentId,
            conversationId: req.query.conversationId
          };
          const results = await memoryEngine.search(criteria);
          return {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: results || []
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

    // --- POST /api/memory ---
    this.registerRoute({
      method: "POST",
      path: "/api/memory",
      metadata: { builtIn: false },
      handler: async (req: any) => {
        const { key, content, type, scope, importance, tags, agentId } = req.body || {};
        if (!key || !content) {
          return {
            status: 400,
            headers: { "Content-Type": "application/json" },
            body: { success: false, error: "Missing required parameters: key and content" }
          };
        }
        try {
          const memoryEngine = (this.context as any).memoryEngine;
          if (!memoryEngine) {
            return {
              status: 500,
              headers: { "Content-Type": "application/json" },
              body: { success: false, error: "MemoryEngine not registered on context" }
            };
          }
          const entry = await memoryEngine.store({
            key,
            content,
            type: type || "EPHEMERAL",
            scope: scope || "AGENT",
            importance: importance || "MEDIUM",
            tags: tags || [],
            agentId: agentId || "default",
            metadata: {}
          });
          return {
            status: 201,
            headers: { "Content-Type": "application/json" },
            body: entry
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

    // --- DELETE /api/memory/:id ---
    this.registerRoute({
      method: "DELETE",
      path: "/api/memory/:id",
      metadata: { builtIn: false },
      handler: async (req: any) => {
        const memoryId = req.params.id;
        if (!memoryId) {
          return {
            status: 400,
            headers: { "Content-Type": "application/json" },
            body: { success: false, error: "Missing memory id" }
          };
        }
        try {
          const memoryEngine = (this.context as any).memoryEngine;
          if (!memoryEngine) {
            return {
              status: 500,
              headers: { "Content-Type": "application/json" },
              body: { success: false, error: "MemoryEngine not registered on context" }
            };
          }
          const deleted = await memoryEngine.delete(memoryId);
          return {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: { success: deleted }
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

    // --- POST /api/auth/login ---
    this.registerRoute({
      method: "POST",
      path: "/api/auth/login",
      metadata: { builtIn: false },
      handler: async (req: any) => {
        const { username, password } = req.body || {};
        const expectedUser = process.env.AUTH_USER || "shaily_admin";
        const expectedPass = process.env.AUTH_PASSWORD || "shaily_secure_password_123";

        if (username === expectedUser && password === expectedPass) {
          const secret = process.env.JWT_SECRET || "shaily-studio-default-jwt-secret-key-12345";
          const token = JWT.sign({ username, role: "admin" }, secret, 86400); // 24 hours
          return {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: { success: true, token }
          };
        }

        return {
          status: 401,
          headers: { "Content-Type": "application/json" },
          body: { success: false, error: "Invalid username or password" }
        };
      }
    });

    // --- POST /api/internal/run-pipeline ---
    this.registerRoute({
      method: "POST",
      path: "/api/internal/run-pipeline",
      metadata: { builtIn: false },
      handler: async (req: any) => {
        // 1. Verify shared secret
        const incomingSecret = req.headers["x-internal-secret"] || req.headers["X-Internal-Secret"];
        const expectedSecret = process.env.INTERNAL_API_SECRET;
        if (!expectedSecret || incomingSecret !== expectedSecret) {
          return {
            status: 401,
            headers: { "Content-Type": "application/json" },
            body: { success: false, error: "Unauthorized: Invalid or missing X-Internal-Secret header" }
          };
        }

        // 2. Validate request body
        const { taskId, prompt } = req.body || {};
        if (!taskId || !prompt) {
          return {
            status: 400,
            headers: { "Content-Type": "application/json" },
            body: { success: false, error: "Missing required parameters: taskId and prompt" }
          };
        }

        // 3. Get ContentPipelineEngine
        const engine = await this.getContentPipelineEngine();
        if (!engine) {
          return {
            status: 500,
            headers: { "Content-Type": "application/json" },
            body: { success: false, error: "ContentPipelineEngine not registered on context" }
          };
        }

        // 4. Run pipeline execution asynchronously
        (async () => {
          try {
            // Force the state of the engine to EXECUTING so it can run again
            (engine as any)._state = "EXECUTING";

            this.context.logger.info(`Starting pipeline run for task ${taskId}...`);
            const pack = await engine.execute(taskId, taskId, prompt);
            this.context.logger.info(`Pipeline execution succeeded for task ${taskId}`);

            const db = await this.getDatabaseEngine();
            const qm = db.getQueryManager();
            await qm.execute({
              id: `db-task-complete-${Date.now()}`,
              sql: "UPDATE tasks SET status = ?, input_data = ?, updated_at = ? WHERE id = ?",
              params: ["completed", JSON.stringify(pack), new Date().toISOString(), taskId]
            });
          } catch (err: any) {
            this.context.logger.error(`Pipeline execution failed for task ${taskId}: ${err.message}`);
            try {
              const db = await this.getDatabaseEngine();
              const qm = db.getQueryManager();
              await qm.execute({
                id: `db-task-failed-${Date.now()}`,
                sql: "UPDATE tasks SET status = ?, error = ?, updated_at = ? WHERE id = ?",
                params: ["failed", err.message || "Unknown error", new Date().toISOString(), taskId]
              });
            } catch (dbErr: any) {
              this.context.logger.error(`Failed to update task ${taskId} to failed in DB: ${dbErr.message}`);
            }
          }
        })();

        // 5. Return success immediately
        return {
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: { success: true }
        };
      }
    });

    // --- POST /api/internal/task/:type ---
    this.registerRoute({
      method: "POST",
      path: "/api/internal/task/:type",
      metadata: { builtIn: false },
      handler: async (req: any) => {
        const incomingSecret = req.headers["x-internal-secret"] || req.headers["X-Internal-Secret"];
        const expectedSecret = process.env.INTERNAL_API_SECRET;
        if (!expectedSecret || incomingSecret !== expectedSecret) {
          return {
            status: 401,
            headers: { "Content-Type": "application/json" },
            body: { success: false, error: "Unauthorized: Invalid or missing X-Internal-Secret header" }
          };
        }

        const { type } = req.params;
        const { taskId, prompt, data } = req.body || {};

        if (!taskId) {
          return {
            status: 400,
            headers: { "Content-Type": "application/json" },
            body: { success: false, error: "Missing required parameter: taskId" }
          };
        }

        try {
          const pipeline = await this.getContentPipelineEngine();
          if (!pipeline) {
            throw new Error("ContentPipelineEngine not registered on context");
          }

          let result: any = null;

          if (type === "image_generation") {
            const mediaProviderEngine = pipeline.context.mediaProviderEngine;
            if (!mediaProviderEngine) throw new Error("MediaProviderEngine not found on context");
            result = await mediaProviderEngine.getImageManager().generateImage({
              id: taskId,
              prompt: prompt || data?.prompt,
              size: data?.size || "1024x1024",
              mode: data?.mode || "TEXT_TO_IMAGE"
            });
          } else if (type === "voice_generation") {
            const mediaProviderEngine = pipeline.context.mediaProviderEngine;
            if (!mediaProviderEngine) throw new Error("MediaProviderEngine not found on context");
            result = await mediaProviderEngine.getVoiceManager().textToSpeech({
              id: taskId,
              text: prompt || data?.text,
              voiceId: data?.voiceId || "default"
            });
          } else if (type === "scene_render" || type === "video_render") {
            const renderEngine = pipeline.context.renderEngine;
            if (!renderEngine) throw new Error("RenderEngine not found on context");
            result = await renderEngine.render({
              id: taskId,
              compositionId: data?.compositionId || "default",
              format: data?.format || "mp4",
              resolution: data?.resolution || "1080p",
              quality: data?.quality || "standard",
              codec: data?.codec || "h264",
              fps: data?.fps || 30,
              state: "CREATED",
              timestamp: new Date(),
              options: data?.options
            });
          } else if (type === "quality_check") {
            const qualityEngine = pipeline.context.qualityEngine;
            if (!qualityEngine) throw new Error("QualityEngine not found on context");
            result = await qualityEngine.review({
              id: taskId,
              renderId: data?.renderId
            });
          } else if (type === "publishing") {
            const youtubeIntegrationEngine = pipeline.context.youtubeIntegrationEngine;
            if (!youtubeIntegrationEngine) throw new Error("YouTubeIntegrationEngine not found on context");
            result = await youtubeIntegrationEngine.uploadVideo({
              id: taskId,
              projectId: data?.projectId || "default",
              videoFileUrl: data?.videoFileUrl,
              thumbnailUrl: data?.thumbnailUrl,
              title: data?.title || "Video",
              description: data?.description || "",
              tags: data?.tags || [],
              privacy: data?.privacy || "private",
              category: data?.category || "Education"
            });
          } else {
            throw new Error(`Unsupported task type: ${type}`);
          }

          // Update task in DB
          const db = await this.getDatabaseEngine();
          const qm = db.getQueryManager();
          await qm.execute({
            id: `db-task-complete-${Date.now()}`,
            sql: "UPDATE tasks SET status = ?, input_data = ?, updated_at = ? WHERE id = ?",
            params: ["completed", JSON.stringify(result), new Date().toISOString(), taskId]
          });

          return {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: { success: true, result }
          };
        } catch (err: any) {
          this.context.logger.error(`Internal task execution failed: ${err.message}`);
          try {
            const db = await this.getDatabaseEngine();
            const qm = db.getQueryManager();
            await qm.execute({
              id: `db-task-failed-${Date.now()}`,
              sql: "UPDATE tasks SET status = ?, error = ?, updated_at = ? WHERE id = ?",
              params: ["failed", err.message || "Unknown error", new Date().toISOString(), taskId]
            });
          } catch (dbErr: any) {
            this.context.logger.error(`Failed to update task ${taskId} in database: ${dbErr.message}`);
          }

          return {
            status: 500,
            headers: { "Content-Type": "application/json" },
            body: { success: false, error: err.message }
          };
        }
      }
    });

    // --- GET /api/internal/download-render/:filename ---
    this.registerRoute({
      method: "GET",
      path: "/api/internal/download-render/:filename",
      metadata: { builtIn: false },
      handler: async (req: any): Promise<GatewayResponse> => {
        // 1. Extract and sanitize filename
        const filename = req.params.filename;
        if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
          return {
            status: 400,
            headers: { "Content-Type": "application/json" },
            body: { success: false, error: "Bad Request: Invalid or unsafe filename" }
          } as GatewayResponse;
        }

        // 2. Build full path and check existence
        const filePath = path.join(process.cwd(), "storage", "media", filename);
        if (!fs.existsSync(filePath)) {
          return {
            status: 404,
            headers: { "Content-Type": "application/json" },
            body: { success: false, error: "Not Found: Render file does not exist" }
          } as GatewayResponse;
        }

        // 3. Stream the file back with HTTP Range support
        try {
          const stat = fs.statSync(filePath);
          const fileSize = stat.size;
          const range = req.headers.range || req.headers.Range;

          if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            if (start >= fileSize || end >= fileSize || start > end) {
              return {
                status: 416,
                headers: {
                  "Content-Range": `bytes */${fileSize}`,
                  "Content-Type": "text/plain"
                },
                body: "Requested Range Not Satisfiable"
              } as GatewayResponse;
            }

            const chunksize = (end - start) + 1;
            const fileStream = fs.createReadStream(filePath, { start, end });
            return {
              status: 206,
              headers: {
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunksize.toString(),
                "Content-Type": "video/mp4",
                "Content-Disposition": `inline; filename="${filename}"`
              },
              body: fileStream
            } as GatewayResponse;
          } else {
            return {
              status: 200,
              headers: {
                "Content-Length": fileSize.toString(),
                "Content-Type": "video/mp4",
                "Content-Disposition": `inline; filename="${filename}"`
              },
              body: fs.createReadStream(filePath)
            } as GatewayResponse;
          }
        } catch (err: any) {
          return {
            status: 500,
            headers: { "Content-Type": "application/json" },
            body: { success: false, error: `Server Error: ${err.message}` }
          } as GatewayResponse;
        }
      }
    });

  }
}
