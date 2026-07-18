import { ProductionState }       from "./ProductionState";
import { CertificationLevel }    from "./CertificationLevel";
import type {
  ProductionRequest,
  ProductionResponse,
  IntegrationReport,
  ValidationReport,
  BenchmarkReport,
  StressTestReport,
  DeploymentProfile,
  CertificationReport,
  ReleasePackage,
  ProductionSnapshot,
} from "./models";

// ─── Production Ready Engine ──────────────────────────────────────────────────

export interface IProductionReadyEngine {
  readonly state: ProductionState;

  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  /** Execute complete validation, benchmarking, stress testing, packaging and certification */
  certify(request: ProductionRequest): Promise<ProductionResponse>;

  /** Get the latest snapshot of certifications and releases */
  getSnapshot(): ProductionSnapshot;

  /** Get reports by ID */
  getIntegrationReport(): IntegrationReport | undefined;
  getBenchmarkReport(): BenchmarkReport | undefined;
  getStressReport(): StressTestReport | undefined;

  // Sub-systems exposure
  getValidator(): IIntegrationValidator;
  getBenchmarkRunner(): IBenchmarkRunner;
  getStressTester(): IStressTester;
  getDocGenerator(): IDocumentationGenerator;
  getCertificationEngine(): ICertificationEngine;
  getPackager(): IDeploymentPackager;
}

// ─── Sub-Systems ──────────────────────────────────────────────────────────────

export interface IIntegrationValidator {
  validateIntegration(context: any): Promise<ValidationReport>;
}

export interface IBenchmarkRunner {
  runBenchmarks(context: any): Promise<BenchmarkReport>;
}

export interface IStressTester {
  runStressTests(context: any): Promise<StressTestReport>;
}

export interface IDocumentationGenerator {
  generateDocs(context: any): Promise<boolean>;
}

export interface ICertificationEngine {
  grantCertification(level: CertificationLevel): Promise<CertificationReport>;
}

export interface IDeploymentPackager {
  createPackage(request: ProductionRequest): Promise<ReleasePackage>;
}
