import { StabilityState } from "./StabilityState";
import { TestState } from "./TestState";
import { StressState } from "./StressState";
import { PerformanceState } from "./PerformanceState";
import { MemoryHealth } from "./MemoryHealth";
import { CrashRecoveryState } from "./CrashRecoveryState";
import { OptimizationState } from "./OptimizationState";
import { CertificationState } from "./CertificationState";

// 1. StabilityConfiguration
export interface StabilityConfiguration {
  environment: string;
  stressTestEnabled: boolean;
  performanceProfilingEnabled: boolean;
  memoryAnalysisEnabled: boolean;
  crashRecoveryCheckEnabled: boolean;
  optimizationEnabled: boolean;
  documentationGenerationEnabled: boolean;
  durationMs: number;
}

// 2. StabilityRequest
export interface StabilityRequest {
  testSuiteIds: string[];
  forceRecalculation: boolean;
  concurrencyLimit: number;
}

// 3. StabilityResponse
export interface StabilityResponse {
  success: boolean;
  message: string;
  timestamp: Date;
  state: StabilityState;
}

// 4. TestSuite
export interface TestSuite {
  id: string;
  name: string;
  description: string;
  testCases: TestCase[];
}

// 5. TestCase
export interface TestCase {
  id: string;
  name: string;
  state: TestState;
  durationMs?: number;
  errorMessage?: string;
}

// 6. TestResult
export interface TestResult {
  suiteId: string;
  caseId: string;
  status: TestState;
  executionTimeMs: number;
  failureMessage?: string;
}

// 7. StressScenario
export interface StressScenario {
  id: string;
  name: string;
  concurrentCommands: number;
  scheduledTasks: number;
  durationMs: number;
}

// 8. StressReport
export interface StressReport {
  scenarioId: string;
  status: StressState;
  completedAt: Date;
  maxThroughputPerSec: number;
  failureRate: number;
}

// 9. PerformanceMetrics
export interface PerformanceMetrics {
  startupTimeMs: number;
  shutdownTimeMs: number;
  averageResponseLatencyMs: number;
  averageSearchLatencyMs: number;
  optimizationDurationMs: number;
}

// 10. PerformanceProfile
export interface PerformanceProfile {
  timestamp: Date;
  overallRating: PerformanceState;
  metrics: PerformanceMetrics;
  benchmarks: EngineBenchmark[];
}

// 11. EngineBenchmark
export interface EngineBenchmark {
  engineId: string;
  initTimeMs: number;
  opsPerSec: number;
  peakMemoryBytes: number;
}

// 12. MemorySnapshot
export interface MemorySnapshot {
  timestamp: Date;
  heapUsedBytes: number;
  heapTotalBytes: number;
  externalBytes: number;
  rssBytes: number;
}

// 13. MemoryReport
export interface MemoryReport {
  snapshots: MemorySnapshot[];
  health: MemoryHealth;
  growthRatePerMinBytes: number;
  leakSuspected: boolean;
}

// 14. CrashScenario
export interface CrashScenario {
  targetEngineId: string;
  triggerType: "uncaught_exception" | "oom" | "timeout";
  autoRecover: boolean;
}

// 15. RecoveryReport
export interface RecoveryReport {
  scenarioId: string;
  state: CrashRecoveryState;
  restartedSuccessfully: boolean;
  timeToRecoverMs: number;
  logs: string[];
}

// 16. StartupProfile
export interface StartupProfile {
  initOrder: string[];
  parallelBootTimeMs: number;
  warmupTimeMs: number;
}

// 17. ShutdownProfile
export interface ShutdownProfile {
  flushTimeMs: number;
  cleanupTimeMs: number;
  gracefulStop: boolean;
}

// 18. OptimizationReport
export interface OptimizationReport {
  state: OptimizationState;
  completedAt: Date;
  gainsPercent: number;
  notes: string[];
}

// 19. DocumentationBundle
export interface DocumentationBundle {
  generatedAt: Date;
  filePath: string;
  summary: string;
  apiCount: number;
}

// 20. SystemStatistics
export interface SystemStatistics {
  uptimeMs: number;
  totalErrorsCount: number;
  totalEventsProcessed: number;
}

// 21. ValidationSummary
export interface ValidationSummary {
  isValid: boolean;
  rulesCheckedCount: number;
  failedRulesCount: number;
  criticalIssues: string[];
}

// 22. FinalAudit
export interface FinalAudit {
  auditedAt: Date;
  complianceLevel: string;
  findings: string[];
}

// 23. AIOSCertification
export interface AIOSCertification {
  certifiedAt: Date;
  state: CertificationState;
  signature: string;
  checklist: Record<string, boolean>;
}

// 24. StabilitySnapshot
export interface StabilitySnapshot {
  state: StabilityState;
  configuration: StabilityConfiguration;
  timestamp: Date;
}

// 25. CertificationReport
export interface CertificationReport {
  certification: AIOSCertification;
  testState: TestState;
  perfRating: PerformanceState;
  memHealth: MemoryHealth;
  recoveryState: CrashRecoveryState;
}
