import { PerformanceState } from "./PerformanceState";
import { CacheStrategy } from "./CacheStrategy";
import { ExecutionMode } from "./ExecutionMode";
import { ProfilingLevel } from "./ProfilingLevel";
import { ResourceType } from "./ResourceType";
import {
  PerformanceSnapshot,
  ExecutionProfile,
  PerformanceMetric,
  CacheEntry,
  CacheStatistics,
  OptimizationResult,
  ThreadPool,
  ParallelTask,
  ExecutionQueue,
  PerformanceAlert,
  ResourceUsage,
  Bottleneck,
  OptimizationHistory,
  StartupProfile,
  ShutdownProfile,
  RenderProfile,
  DatabaseProfile,
  ProviderProfile,
  DashboardProfile,
  MemoryStatistics,
  PerformanceRecommendation,
  PerformanceStatistics,
  PerformanceCheckpoint,
  PerformanceReport,
  PerformanceBenchmark
} from "./models";

export interface IPerformanceEngine {
  getState(): PerformanceState;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  getSnapshot(): PerformanceSnapshot;
  getStatistics(): PerformanceStatistics;
  
  getProfilerManager(): IProfilerManager;
  getCacheManager(): ICacheManager;
  getMemoryManager(): IMemoryManager;
  getThreadManager(): IThreadManager;
  getQueueManager(): IQueueManager;
  getBenchmarkManager(): IBenchmarkManager;
  getOptimizationManager(): IOptimizationManager;
  getResourceManager(): IResourceManager;
  getStatisticsManager(): IStatisticsManager;
  getHistoryManager(): IHistoryManager;
  
  on(event: string, handler: (payload: any) => void): void;
  off(event: string, handler: (payload: any) => void): void;
}

export interface IProfilerManager {
  startProfiling(name: string, level?: ProfilingLevel): string;
  stopProfiling(profileId: string): ExecutionProfile;
  profileRuntime(): Promise<ExecutionProfile>;
  profilePipeline(): Promise<RenderProfile>;
  profileDatabase(): Promise<DatabaseProfile>;
  profileProviders(): Promise<ProviderProfile[]>;
  profileDashboard(): Promise<DashboardProfile>;
  profileAnalytics(): Promise<ExecutionProfile>;
}

export interface ICacheManager {
  get(key: string): any;
  set(key: string, value: any, options?: { ttlMs?: number; strategy?: CacheStrategy }): void;
  delete(key: string): void;
  clear(): void;
  getStatistics(): CacheStatistics;
  evictExpired(): number;
  evictLRU(count?: number): number;
}

export interface IMemoryManager {
  getMemoryStatistics(): Promise<MemoryStatistics>;
  compactHeap(): Promise<number>;
  detectLeaks(): Promise<string[]>;
  freeExpiredCaches(): number;
  removeUnusedResources(): void;
}

export interface IThreadManager {
  getThreadPool(): ThreadPool;
  enqueueParallelTask(task: () => Promise<any>, name: string, priority?: number): Promise<any>;
  getActiveTasks(): ParallelTask[];
}

export interface IQueueManager {
  getQueue(name: string): ExecutionQueue;
  prioritizeTask(queueName: string, taskId: string, priority: number): void;
  optimizeQueues(): void;
}

export interface IBenchmarkManager {
  runBenchmark(target: string): Promise<PerformanceBenchmark>;
  getRankings(): Promise<Record<string, number>>;
}

export interface IOptimizationManager {
  optimizeStartup(): Promise<StartupProfile>;
  optimizeShutdown(): Promise<ShutdownProfile>;
  optimizePipeline(): Promise<RenderProfile>;
  optimizeDatabaseQueries(): Promise<DatabaseProfile>;
  optimizeMemoryUsage(): Promise<number>;
  optimizeCacheUsage(): Promise<number>;
  optimizeProviderLatency(): Promise<ProviderProfile[]>;
  getOptimizationHistory(): OptimizationHistory[];
}

export interface IResourceManager {
  getResourceUsage(type: ResourceType): Promise<ResourceUsage>;
  checkThresholds(): Promise<PerformanceAlert[]>;
  getAlerts(): PerformanceAlert[];
}

export interface IStatisticsManager {
  getStats(): PerformanceStatistics;
  recordLatency(provider: string, ms: number): void;
  recordMemorySavings(bytes: number): void;
  updateHitRatio(ratio: number): void;
}

export interface IHistoryManager {
  saveBenchmark(benchmark: PerformanceBenchmark): Promise<void>;
  getBenchmarks(): PerformanceBenchmark[];
  saveOptimization(result: OptimizationResult): Promise<void>;
  getOptimizations(): OptimizationResult[];
  saveSnapshot(snapshot: PerformanceSnapshot): void;
  getSnapshots(): PerformanceSnapshot[];
}
