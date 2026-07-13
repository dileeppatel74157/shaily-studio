import { Studio } from "./Studio";
import { StudioMetadata } from "./StudioMetadata";
import { StudioContext } from "./StudioContext";
import { StudioValidator } from "./StudioValidator";
import {
  LOGGER_TOKEN,
  CONFIG_TOKEN,
  REGISTRY_TOKEN,
  EVENT_BUS_TOKEN,
  JOB_ENGINE_TOKEN,
  MEMORY_STORE_TOKEN,
  AGENT_REGISTRY_TOKEN,
  WORKFLOW_ENGINE_TOKEN,
  KERNEL_TOKEN,
} from "./StudioServices";
import {
  LoggerBuilder,
  ConsoleTransport,
  JsonFormatter,
  ConfigBuilder,
  RegistryBuilder,
  EventBus,
  JobEngine,
  MemoryStore,
  AgentRegistry,
  WorkflowEngine,
  KernelBuilder,
  Version,
} from "@shaily/core";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class StudioBuilder {
  private _environment = "development";
  private _version = "1.0.0";
  private _configSchema: Record<string, any> = {};

  public withEnvironment(environment: string): this {
    this._environment = environment;
    return this;
  }

  public withVersion(version: string): this {
    this._version = version;
    return this;
  }

  public withConfigSchema(schema: Record<string, any>): this {
    this._configSchema = { ...schema };
    return this;
  }

  public async build(): Promise<Studio> {
    const id = generateUUID();
    const metadata: StudioMetadata = {
      id,
      version: this._version,
      environment: this._environment,
    };

    const validator = new StudioValidator();
    validator.validateMetadata(metadata);

    // Boot Order implementation:
    // 1. Logger
    const formatter = new JsonFormatter();
    const logger = new LoggerBuilder()
      .addTransport(new ConsoleTransport(formatter))
      .withFormatter(formatter)
      .build();

    // 2. Configuration
    const config = await new ConfigBuilder(this._configSchema).build();

    // 3. Service Registry
    const registry = new RegistryBuilder().build();

    // 4. Event Bus
    const eventBus = new EventBus(logger);

    // 5. Job Engine
    const jobEngine = new JobEngine(logger, eventBus);

    // 6. Memory Store
    const memoryStore = new MemoryStore();

    // 7. Agent Registry
    const agentRegistry = new AgentRegistry();

    // 8. Workflow Engine
    const workflowEngine = new WorkflowEngine();

    // 9. Kernel
    const parsedVersion = Version.parse(this._version);
    const kernel = new KernelBuilder()
      .withVersion(parsedVersion)
      .withEnvironment(this._environment)
      .registerService(LOGGER_TOKEN, logger)
      .registerService(CONFIG_TOKEN, config)
      .registerService(REGISTRY_TOKEN, registry)
      .registerService(EVENT_BUS_TOKEN, eventBus)
      .registerService(JOB_ENGINE_TOKEN, jobEngine)
      .registerService(MEMORY_STORE_TOKEN, memoryStore)
      .registerService(AGENT_REGISTRY_TOKEN, agentRegistry)
      .registerService(WORKFLOW_ENGINE_TOKEN, workflowEngine)
      .build();

    // Register all services in the main Service Registry
    registry.register(LOGGER_TOKEN, logger);
    registry.register(CONFIG_TOKEN, config);
    registry.register(REGISTRY_TOKEN, registry);
    registry.register(EVENT_BUS_TOKEN, eventBus);
    registry.register(JOB_ENGINE_TOKEN, jobEngine);
    registry.register(MEMORY_STORE_TOKEN, memoryStore);
    registry.register(AGENT_REGISTRY_TOKEN, agentRegistry);
    registry.register(WORKFLOW_ENGINE_TOKEN, workflowEngine);
    registry.register(KERNEL_TOKEN, kernel);

    const context: StudioContext = {
      logger,
      config,
      registry,
      eventBus,
      jobs: jobEngine,
      memory: memoryStore,
      agents: agentRegistry,
      workflow: workflowEngine,
      kernel,
    };

    return new Studio(metadata, context);
  }
}
