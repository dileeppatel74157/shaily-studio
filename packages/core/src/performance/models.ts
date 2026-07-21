import { PerformanceState } from "./PerformanceState";
import { OptimizationState } from "./OptimizationState";
import { CacheStrategy } from "./CacheStrategy";
import { ExecutionMode } from "./ExecutionMode";
import { ResourceType } from "./ResourceType";
import { ProfilingLevel } from "./ProfilingLevel";

export interface PerformanceSnapshot {
  timestamp: Date;
  state: PerformanceState;
  cpu: CpuProfile;
  memory: MemoryProfile;
  disk: DiskProfile;
  statistics: PerformanceStatistics;
  recommendations: PerformanceRecommendation[];
}

export interface ExecutionProfile {
  id: string;
  name: string;
  level: ProfilingLevel;
  durationMs: number;
  cpuUsagePercent: number;
  memoryAllocatedBytes: number;
  startedAt: Date;
  completedAt: Date;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
}

export interface CpuProfile {
  usagePercent: number;
  coresCount: number;
  loadAverage: number[];
  processCpuUsagePercent: number;
}

export interface MemoryProfile {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  heapTotalBytes: number;
  heapUsedBytes: number;
  externalBytes: number;
}

export interface DiskProfile {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  readBytesPerSec: number;
  writeBytesPerSec: number;
}

export interface ProviderLatency {
  provider: string;
  latencyMs: number;
  timestamp: Date;
}

export interface PipelineTiming {
  stage: string;
  durationMs: number;
  timestamp: Date;
}

export interface CacheEntry {
  key: string;
  value: any;
  strategy: CacheStrategy;
  hitsCount: number;
  expiresAt?: Date;
  lastAccessed: Date;
}

export interface CacheStatistics {
  hits: number;
  misses: number;
  evictions: number;
  hitRatio: number;
}

export interface OptimizationResult {
  id: string;
  target: string;
  state: OptimizationState;
  scoreBefore: number;
  scoreAfter: number;
  savingsPercent: number;
  timestamp: Date;
}

export interface ThreadPool {
  id: string;
  activeCount: number;
  maxCount: number;
  queueSize: number;
  tasksCompleted: number;
}

export interface ParallelTask {
  id: string;
  name: string;
  mode: ExecutionMode;
  priority: number;
  startedAt: Date;
}

export interface ExecutionQueue {
  name: string;
  length: number;
  maxCapacity: number;
  mode: ExecutionMode;
}

export interface PerformanceAlert {
  id: string;
  resource: ResourceType;
  value: number;
  threshold: number;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  timestamp: Date;
}

export interface ResourceUsage {
  resource: ResourceType;
  usage: number;
  limit: number;
}

export interface Bottleneck {
  id: string;
  component: string;
  resource: ResourceType;
  severity: number;
  description: string;
}

export interface OptimizationHistory {
  optimizationId: string;
  target: string;
  scoreBefore: number;
  scoreAfter: number;
  timestamp: Date;
}

export interface StartupProfile {
  durationMs: number;
  enginesTiming: Record<string, number>;
  timestamp: Date;
}

export interface ShutdownProfile {
  durationMs: number;
  cleanupTiming: Record<string, number>;
  timestamp: Date;
}

export interface RenderProfile {
  videoName: string;
  framesCount: number;
  durationMs: number;
  avgFrameDurationMs: number;
}

export interface DatabaseProfile {
  queryCount: number;
  avgQueryDurationMs: number;
  slowQueriesCount: number;
}

export interface ProviderProfile {
  provider: string;
  averageLatencyMs: number;
  successRate: number;
}

export interface DashboardProfile {
  refreshDurationMs: number;
  widgetUpdatesCount: number;
  activeWidgetsCount: number;
}

export interface MemoryStatistics {
  heapTotalBytes: number;
  heapUsedBytes: number;
  gcRunsCount: number;
  leakWarningsCount: number;
}

export interface PerformanceRecommendation {
  id: string;
  category: string;
  target: string;
  suggestion: string;
  estimatedImpactPercent: number;
}

export interface PerformanceStatistics {
  averageLatency: number;
  maxLatency: number;
  throughput: number;
  memorySavings: number;
  cacheHitRatio: number;
  startupTime: number;
  optimizationPercentage: number;
}

export interface PerformanceCheckpoint {
  name: string;
  timestamp: Date;
  elapsedMs: number;
}

export interface PerformanceReport {
  id: string;
  timestamp: Date;
  overallScore: number;
  stats: PerformanceStatistics;
  bottlenecks: Bottleneck[];
}

export interface PerformanceBenchmark {
  id: string;
  name: string;
  durationMs: number;
  operationsPerSec: number;
  score: number;
  timestamp: Date;
}
