import {
  PerformanceSnapshot,
  ExecutionProfile,
  CacheEntry,
  ThreadPool,
  ExecutionQueue,
  PerformanceAlert,
  PerformanceBenchmark,
  PerformanceRecommendation
} from "./models";
import {
  PerformanceException,
  CacheException,
  MemoryOptimizationException,
  BenchmarkException,
  ProfilingException
} from "./types";

export class PerformanceValidator {
  public validate(snapshot: PerformanceSnapshot): void {
    if (!snapshot) {
      throw new PerformanceException("Performance snapshot is undefined.");
    }

    // 1-3. CPU validation
    if (snapshot.cpu.usagePercent < 0 || snapshot.cpu.usagePercent > 100) {
      throw new PerformanceException(`CPU usage percent must be between 0 and 100. Got: ${snapshot.cpu.usagePercent}`);
    }
    if (snapshot.cpu.processCpuUsagePercent < 0 || snapshot.cpu.processCpuUsagePercent > 100) {
      throw new PerformanceException(`Process CPU usage percent must be between 0 and 100. Got: ${snapshot.cpu.processCpuUsagePercent}`);
    }
    if (snapshot.cpu.coresCount <= 0) {
      throw new PerformanceException(`Cores count must be positive. Got: ${snapshot.cpu.coresCount}`);
    }

    // 4-6. Memory validation
    if (snapshot.memory.totalBytes < 0) {
      throw new PerformanceException(`Total memory bytes cannot be negative. Got: ${snapshot.memory.totalBytes}`);
    }
    if (snapshot.memory.usedBytes < 0) {
      throw new PerformanceException(`Used memory bytes cannot be negative. Got: ${snapshot.memory.usedBytes}`);
    }
    if (snapshot.memory.freeBytes < 0) {
      throw new PerformanceException(`Free memory bytes cannot be negative. Got: ${snapshot.memory.freeBytes}`);
    }

    // 7. Memory consistency
    if (snapshot.memory.usedBytes > snapshot.memory.totalBytes) {
      throw new PerformanceException(`Used memory (${snapshot.memory.usedBytes}) exceeds total memory (${snapshot.memory.totalBytes}).`);
    }

    // 8-10. Disk validation
    if (snapshot.disk.totalBytes < 0) {
      throw new PerformanceException(`Disk total bytes cannot be negative. Got: ${snapshot.disk.totalBytes}`);
    }
    if (snapshot.disk.usedBytes < 0) {
      throw new PerformanceException(`Disk used bytes cannot be negative. Got: ${snapshot.disk.usedBytes}`);
    }
    if (snapshot.disk.readBytesPerSec < 0 || snapshot.disk.writeBytesPerSec < 0) {
      throw new PerformanceException("Disk I/O transfer rates cannot be negative.");
    }

    // 11. Statistics validation
    if (snapshot.statistics.averageLatency < 0) {
      throw new PerformanceException(`Average latency cannot be negative. Got: ${snapshot.statistics.averageLatency}`);
    }
  }

  // 12. Cache Key validation
  public validateCacheKey(key: string): void {
    if (!key || key.trim() === "") {
      throw new CacheException("Cache key cannot be empty.");
    }
  }

  // 13. Cache Entry expiration validation
  public validateCacheEntry(entry: CacheEntry): void {
    if (!entry.key) {
      throw new CacheException("Cache entry must have a valid key.");
    }
    if (entry.hitsCount < 0) {
      throw new CacheException(`Cache entry hits count cannot be negative. Got: ${entry.hitsCount}`);
    }
  }

  // 14. Thread Pool validation
  public validateThreadPool(pool: ThreadPool): void {
    if (pool.maxCount <= 0) {
      throw new PerformanceException(`ThreadPool maximum thread count must be positive. Got: ${pool.maxCount}`);
    }
    if (pool.activeCount < 0 || pool.activeCount > pool.maxCount) {
      throw new PerformanceException(`ThreadPool active threads must be between 0 and max threads count. Got active: ${pool.activeCount}, max: ${pool.maxCount}`);
    }
    if (pool.queueSize < 0) {
      throw new PerformanceException(`ThreadPool task queue size cannot be negative. Got: ${pool.queueSize}`);
    }
  }

  // 15. Queue validation
  public validateQueue(queue: ExecutionQueue): void {
    if (queue.length < 0) {
      throw new PerformanceException(`Queue length cannot be negative. Got: ${queue.length}`);
    }
    if (queue.maxCapacity <= 0) {
      throw new PerformanceException(`Queue maximum capacity must be positive. Got: ${queue.maxCapacity}`);
    }
    if (queue.length > queue.maxCapacity) {
      throw new PerformanceException(`Queue length (${queue.length}) exceeds maximum capacity (${queue.maxCapacity}).`);
    }
  }

  // 16. Alert validation
  public validateAlert(alert: PerformanceAlert): void {
    if (alert.value < 0 || alert.threshold < 0) {
      throw new PerformanceException("Alert metrics values and thresholds cannot be negative.");
    }
  }

  // 17. Recommendation validation
  public validateRecommendation(rec: PerformanceRecommendation): void {
    if (rec.estimatedImpactPercent <= 0) {
      throw new PerformanceException(`Recommendation estimated impact percentage must be positive. Got: ${rec.estimatedImpactPercent}`);
    }
  }

  // 18. Benchmark validation
  public validateBenchmark(bench: PerformanceBenchmark): void {
    if (bench.durationMs <= 0) {
      throw new BenchmarkException(`Benchmark execution duration must be positive. Got: ${bench.durationMs}ms`);
    }
    if (bench.operationsPerSec < 0) {
      throw new BenchmarkException(`Benchmark operations rate cannot be negative. Got: ${bench.operationsPerSec} ops/sec`);
    }
  }

  // 19. Profiling validation
  public validateProfile(profile: ExecutionProfile): void {
    if (profile.durationMs < 0) {
      throw new ProfilingException(`Profiling execution duration cannot be negative. Got: ${profile.durationMs}ms`);
    }
    if (profile.cpuUsagePercent < 0 || profile.cpuUsagePercent > 100) {
      throw new ProfilingException(`Profiling CPU usage percent must be between 0 and 100. Got: ${profile.cpuUsagePercent}%`);
    }
  }

  // 20. Latency validation
  public validateLatency(ms: number): void {
    if (ms < 0) {
      throw new PerformanceException(`Latency cannot be negative. Got: ${ms}ms`);
    }
  }
}
