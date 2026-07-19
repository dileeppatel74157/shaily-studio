import { StabilityState } from "./StabilityState";
import { TestState } from "./TestState";
import { StressState } from "./StressState";
import { PerformanceState } from "./PerformanceState";
import { MemoryHealth } from "./MemoryHealth";
import { CrashRecoveryState } from "./CrashRecoveryState";
import { OptimizationState } from "./OptimizationState";
import { CertificationState } from "./CertificationState";
import {
  StabilityConfiguration,
  StabilityRequest,
  StabilityResponse,
  TestSuite,
  TestCase,
  TestResult,
  StressScenario,
  StressReport,
  PerformanceProfile,
  PerformanceMetrics,
  MemorySnapshot,
  MemoryReport,
  CrashScenario,
  RecoveryReport,
  StartupProfile,
  ShutdownProfile,
  OptimizationReport,
  DocumentationBundle,
  SystemStatistics,
  ValidationSummary,
  FinalAudit,
  AIOSCertification,
  StabilitySnapshot,
  CertificationReport
} from "./models";

export interface ITestRunner {
  runUnitTests(): Promise<TestResult[]>;
  runIntegrationTests(): Promise<TestResult[]>;
  runEndToEndTests(): Promise<TestResult[]>;
  getTestSuites(): TestSuite[];
}

export interface IStressTester {
  executeStressTest(scenario: StressScenario): Promise<StressReport>;
  getStressReports(): StressReport[];
}

export interface IPerformanceProfiler {
  profilePerformance(): Promise<PerformanceProfile>;
  getPerformanceProfile(): PerformanceProfile;
}

export interface IMemoryAnalyzer {
  analyzeMemory(): Promise<MemoryReport>;
  getMemoryReport(): MemoryReport;
  detectMemoryLeaks(): Promise<boolean>;
}

export interface ICrashRecoveryManager {
  simulateCrash(scenario: CrashScenario): Promise<RecoveryReport>;
  getRecoveryReports(): RecoveryReport[];
}

export interface IStartupOptimizer {
  optimizeStartup(): Promise<StartupProfile>;
  getStartupProfile(): StartupProfile;
}

export interface IShutdownOptimizer {
  optimizeShutdown(): Promise<ShutdownProfile>;
  getShutdownProfile(): ShutdownProfile;
}

export interface IDocumentationGenerator {
  generateDocumentation(): Promise<DocumentationBundle>;
  getDocumentationBundle(): DocumentationBundle;
}

export interface ICertificationManager {
  generateCertification(): Promise<AIOSCertification>;
  getCertification(): AIOSCertification;
  runFinalAudit(): Promise<FinalAudit>;
}

export interface IStabilityPerformanceEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  getState(): StabilityState;
  getSnapshot(): StabilitySnapshot;
  getReport(): Promise<CertificationReport>;
  
  getTestRunner(): ITestRunner;
  getStressTester(): IStressTester;
  getProfiler(): IPerformanceProfiler;
  getMemoryAnalyzer(): IMemoryAnalyzer;
  getRecoveryManager(): ICrashRecoveryManager;
  getStartupOptimizer(): IStartupOptimizer;
  getShutdownOptimizer(): IShutdownOptimizer;
  getDocGenerator(): IDocumentationGenerator;
  getCertificationManager(): ICertificationManager;
}
