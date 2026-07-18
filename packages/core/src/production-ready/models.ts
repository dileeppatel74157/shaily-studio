import { ProductionState }       from "./ProductionState";
import { ValidationState }       from "./ValidationState";
import { BenchmarkState }        from "./BenchmarkState";
import { StressState }           from "./StressState";
import { CertificationLevel }    from "./CertificationLevel";
import { ReleaseType }           from "./ReleaseType";
import { DeploymentTarget }      from "./DeploymentTarget";

// ─── Production Ready Models ──────────────────────────────────────────────────

export interface ProductionRequest {
  id: string;
  releaseType: ReleaseType;
  target: DeploymentTarget;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ProductionResponse {
  id: string;
  requestId: string;
  state: ProductionState;
  level: CertificationLevel;
  certified: boolean;
  packagePath?: string;
  timestamp: Date;
}

export interface IntegrationReport {
  id: string;
  enginesValidated: string[];
  passedCount: number;
  failedCount: number;
  errors: string[];
  timestamp: Date;
}

export interface ValidationReport {
  id: string;
  state: ValidationState;
  circularDependenciesCount: number;
  duplicateExportsCount: number;
  missingInterfacesCount: number;
  errors: string[];
  timestamp: Date;
}

export interface PerformanceMetrics {
  startupTimeMs: number;
  avgPipelineLatencyMs: number;
  avgRoutingLatencyMs: number;
  avgMemoryUsageMb: number;
  avgCpuUsagePercent: number;
  avgGpuUsagePercent: number;
  eventBusThroughputPerSec: number;
}

export interface BenchmarkReport {
  id: string;
  state: BenchmarkState;
  metrics: PerformanceMetrics;
  timestamp: Date;
}

export interface StressTestReport {
  id: string;
  state: StressState;
  totalExecutionsAttempted: number;
  failedCount: number;
  networkFailureRecovered: boolean;
  recoveryValidationPassed: boolean;
  timestamp: Date;
}

export interface DeploymentProfile {
  id: string;
  target: DeploymentTarget;
  envVariables: Record<string, string>;
  dockerConfigPath?: string;
  replicaCount: number;
}

export interface CertificationReport {
  id: string;
  level: CertificationLevel;
  certifiedBy: string;
  auditTrail: string[];
  certifiedAt: Date;
}

export interface ReleasePackage {
  id: string;
  version: string;
  releaseType: ReleaseType;
  archivePath: string;
  documentationGenerated: boolean;
  timestamp: Date;
}

export interface ProductionSnapshot {
  id: string;
  state: ProductionState;
  level: CertificationLevel;
  lastReport?: IntegrationReport;
  lastBenchmark?: BenchmarkReport;
  timestamp: Date;
}
