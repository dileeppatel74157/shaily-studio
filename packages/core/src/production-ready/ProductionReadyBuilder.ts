import { ProductionReadyEngine } from "./ProductionReadyEngine";
import { ProductionValidationException } from "./types";
import type {
  IIntegrationValidator,
  IBenchmarkRunner,
  IStressTester,
  IDocumentationGenerator,
  ICertificationEngine,
  IDeploymentPackager,
} from "./interfaces";

export class ProductionReadyBuilder {
  private _context?: any;
  private _metadata: Record<string, unknown> = {};

  private _validator?: IIntegrationValidator;
  private _benchmarkRunner?: IBenchmarkRunner;
  private _stressTester?: IStressTester;
  private _docGenerator?: IDocumentationGenerator;
  private _certificationEngine?: ICertificationEngine;
  private _packager?: IDeploymentPackager;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...metadata };
    return this;
  }

  public withValidator(val: IIntegrationValidator): this {
    this._validator = val;
    return this;
  }

  public withBenchmarkRunner(runner: IBenchmarkRunner): this {
    this._benchmarkRunner = runner;
    return this;
  }

  public withStressTester(tester: IStressTester): this {
    this._stressTester = tester;
    return this;
  }

  public withDocGenerator(gen: IDocumentationGenerator): this {
    this._docGenerator = gen;
    return this;
  }

  public withCertificationEngine(eng: ICertificationEngine): this {
    this._certificationEngine = eng;
    return this;
  }

  public withPackager(packager: IDeploymentPackager): this {
    this._packager = packager;
    return this;
  }

  public withMemory(memoryStore: any): this {
    if (!this._context) this._context = {};
    this._context.memoryStore = memoryStore;
    return this;
  }

  public withDecision(decisionEngine: any): this {
    if (!this._context) this._context = {};
    this._context.decisionEngine = decisionEngine;
    return this;
  }

  public withPlanner(planningEngine: any): this {
    if (!this._context) this._context = {};
    this._context.planningEngine = planningEngine;
    return this;
  }

  public build(): ProductionReadyEngine {
    if (!this._context) {
      throw new ProductionValidationException("Context is required to build a ProductionReadyEngine.");
    }
    return new ProductionReadyEngine(
      this._context,
      this._validator,
      this._benchmarkRunner,
      this._stressTester,
      this._docGenerator,
      this._certificationEngine,
      this._packager,
      this._metadata
    );
  }
}
