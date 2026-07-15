import { CompositionContext } from "./CompositionContext";
import { CompositionRoot } from "./CompositionRoot";
import { DependencyContainer } from "./DependencyContainer";
import { CompositionValidationException } from "./types";

// Import interfaces
import { IConfiguration } from "../configuration/IConfiguration";
import { ISecurity } from "../security/ISecurity";
import { IStorage } from "../storage/IStorage";
import { IScheduler } from "../scheduler/IScheduler";
import { IObservability } from "../observability/IObservability";
import { IGateway } from "../gateway/IGateway";
import { IMCPServer } from "../mcp/IMCPServer";
import { IMessageBus } from "../messagebus/IMessageBus";
import { IKnowledgeBase } from "../knowledge/IKnowledgeBase";
import { IPromptRegistry } from "../prompts/IPromptRegistry";
import { IRAGEngine } from "../rag/IRAGEngine";
import { IKernel } from "../kernel/IKernel";
import { IBootstrapper } from "../bootstrap/IBootstrapper";
import { IHost } from "../host/IHost";
import { IRuntime } from "../runtime/IRuntime";
import { IStudio } from "../studio/IStudio";
import { IToolRegistry } from "../tools/IToolRegistry";
import { IPluginRegistry } from "../plugins/IPluginRegistry";

// Import builders/concrete classes
import { ConfigurationBuilder } from "../configuration/ConfigurationBuilder";
import { SecurityBuilder } from "../security/SecurityBuilder";
import { StorageBuilder } from "../storage/StorageBuilder";
import { SchedulerBuilder } from "../scheduler/SchedulerBuilder";
import { ObservabilityBuilder } from "../observability/ObservabilityBuilder";
import { MessageBusBuilder } from "../messagebus/MessageBusBuilder";
import { KnowledgeBuilder } from "../knowledge/KnowledgeBuilder";
import { PromptRegistry } from "../prompts/PromptRegistry";
import { RAGBuilder } from "../rag/RAGBuilder";
import { MCPBuilder } from "../mcp/MCPBuilder";
import { MCPTransport } from "../mcp/MCPTransport";
import { ToolRegistry } from "../tools/ToolRegistry";
import { PluginRegistry } from "../plugins/PluginRegistry";
import { KernelBuilder } from "../kernel/KernelBuilder";
import { BootstrapBuilder } from "../bootstrap/BootstrapBuilder";
import { HostBuilder } from "../host/HostBuilder";
import { RuntimeBuilder } from "../runtime/RuntimeBuilder";
import { StudioBuilder } from "../studio/StudioBuilder";


export class CompositionBuilder {
  private _context?: CompositionContext;
  private _metadata: Record<string, unknown> = {};
  private readonly _container = new DependencyContainer();

  public withContext(context: CompositionContext): this {
    this._context = context;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public register(setup: (container: DependencyContainer) => void): this {
    setup(this._container);
    return this;
  }

  public build(): CompositionRoot {
    if (!this._context) {
      throw new CompositionValidationException("CompositionContext is required to build CompositionRoot.");
    }

    // 1. Register Context
    if (!this._container.contains("CompositionContext")) {
      this._container.addSingleton("CompositionContext", this._context);
    }

    // 2. Register Sub-Frameworks if not already overridden by the user
    this.registerDefaults();

    // 3. Build Provider
    const provider = this._container.build();

    // 4. Return CompositionRoot
    return new CompositionRoot(this._context, this._metadata, provider);
  }

  private registerDefaults(): void {
    const c = this._container;

    // Helper function to resolve context
    const getCtx = (p: any) => p.resolve("CompositionContext");

    if (!c.contains("IConfiguration")) {
      c.addSingleton("IConfiguration", null, (p) => {
        return new ConfigurationBuilder()
          .withContext(getCtx(p))
          .withSchema({
            app: {
              type: "string",
              required: false,
              default: "shaily-studio"
            }
          })
          .build();
      });
    }

    if (!c.contains("ISecurity")) {
      c.addSingleton("ISecurity", null, (p) => {
        const compCtx = getCtx(p);
        return new SecurityBuilder()
          .withContext({
            env: compCtx.env,
            tenantId: compCtx.namespace,
            metadata: compCtx.metadata,
          })
          .withPolicy({
            id: "default-policy",
            roles: [],
            permissions: []
          })
          .build();
      });
    }


    if (!c.contains("IStorage")) {
      c.addSingleton("IStorage", null, (p) => {
        return new StorageBuilder()
          .withContext(getCtx(p))
          .build();
      });
    }

    if (!c.contains("IScheduler")) {
      c.addSingleton("IScheduler", null, (p) => {
        return new SchedulerBuilder()
          .withContext(getCtx(p))
          .build();
      });
    }

    if (!c.contains("IObservability")) {
      c.addSingleton("IObservability", null, (p) => {
        return new ObservabilityBuilder()
          .withContext(getCtx(p))
          .build();
      });
    }

    if (!c.contains("IMessageBus")) {
      c.addSingleton("IMessageBus", null, (p) => {
        return new MessageBusBuilder()
          .withContext(getCtx(p))
          .build();
      });
    }

    if (!c.contains("IKnowledgeBase")) {
      c.addSingleton("IKnowledgeBase", null, (p) => {
        return new KnowledgeBuilder()
          .withId("kb-default")
          .withName("Default KnowledgeBase")
          .build();
      });
    }

    if (!c.contains("IPromptRegistry")) {
      c.addSingleton("IPromptRegistry", PromptRegistry);
    }

    if (!c.contains("IRAGEngine")) {
      c.addSingleton("IRAGEngine", null, (p) => {
        return new RAGBuilder()
          .withKnowledgeBase(p.resolve<IKnowledgeBase>("IKnowledgeBase"))
          .withPromptRegistry(p.resolve<PromptRegistry>("IPromptRegistry"))
          .build();
      });
    }

    if (!c.contains("IToolRegistry")) {
      c.addSingleton("IToolRegistry", ToolRegistry);
    }

    if (!c.contains("IPluginRegistry")) {
      c.addSingleton("IPluginRegistry", PluginRegistry);
    }

    if (!c.contains("IMCPServer")) {
      c.addSingleton("IMCPServer", null, (p) => {
        const mockTransport: MCPTransport = {
          type: "stdio" as any,
          send: async () => {},
          receive: async () => ({} as any),
          close: async () => {},
        };
        const mcpCtx = {
          tools: p.resolve<IToolRegistry>("IToolRegistry"),
          prompts: p.resolve<IPromptRegistry>("IPromptRegistry"),
          knowledge: p.resolve<IKnowledgeBase>("IKnowledgeBase"),
          plugins: p.resolve<IPluginRegistry>("IPluginRegistry"),
          metadata: getCtx(p).metadata,
        };
        return new MCPBuilder()
          .withContext(mcpCtx)
          .withTransport(mockTransport)
          .build();
      });
    }


    if (!c.contains("IKernel")) {
      c.addSingleton("IKernel", null, (p) => {
        return new KernelBuilder()
          .withContext(getCtx(p))
          .build();
      });
    }

    if (!c.contains("IBootstrapper")) {
      c.addSingleton("IBootstrapper", null, (p) => {
        return new BootstrapBuilder()
          .withContext(getCtx(p))
          .build();
      });
    }

    if (!c.contains("IHost")) {
      c.addSingleton("IHost", null, (p) => {
        return new HostBuilder()
          .withContext(getCtx(p))
          .withBootstrapper(p.resolve<IBootstrapper>("IBootstrapper"))
          .build();
      });
    }

    if (!c.contains("IRuntime")) {
      c.addSingleton("IRuntime", null, (p) => {
        return new RuntimeBuilder()
          .withContext(getCtx(p))
          .withHost(p.resolve<IHost>("IHost"))
          .build();
      });
    }

    if (!c.contains("IGateway")) {
      class DefaultGateway implements IGateway {
        public get state() { return "CREATED" as any; }
        public get context() { return {} as any; }
        public async initialize() {}
        public async start() {}
        public async stop() {}
        public registerRoute() {}
        public unregisterRoute() { return true; }
        public async handle() { return { status: 200, headers: {}, body: {} }; }
        public snapshot() {
          return {
            state: "CREATED" as any,
            routesCount: 0,
            routes: [],
            middlewaresCount: 0,
            timestamp: new Date(),
            metadata: {},
          };
        }
      }
      c.addSingleton("IGateway", DefaultGateway);
    }

    if (!c.contains("IStudio")) {
      c.addSingleton("IStudio", null, (p) => {
        const studioBuilder = new StudioBuilder()
          .withContext(getCtx(p))
          .withRuntime(p.resolve("IRuntime"))
          .withHost(p.resolve("IHost"))
          .withBootstrapper(p.resolve("IBootstrapper"))
          .withKernel(p.resolve("IKernel"))
          .withConfiguration(p.resolve("IConfiguration"))
          .withSecurity(p.resolve("ISecurity"))
          .withObservability(p.resolve("IObservability"))
          .withStorage(p.resolve("IStorage"))
          .withScheduler(p.resolve("IScheduler"))
          .withGateway(p.resolve("IGateway"))
          .withMCP(p.resolve("IMCPServer"))
          .withMessageBus(p.resolve("IMessageBus"))
          .withKnowledgeBase(p.resolve("IKnowledgeBase"))
          .withPromptRegistry(p.resolve("IPromptRegistry"))
          .withRAG(p.resolve("IRAGEngine"));

        return studioBuilder.build();
      });
    }
  }
}
