import { StabilitySnapshot, PerformanceProfile, MemoryReport, AIOSCertification } from "./models";
import { StabilityState } from "./StabilityState";
import { StabilityValidationException } from "./types";

export class StabilityValidator {
  public validate(
    snapshot: StabilitySnapshot,
    perf: PerformanceProfile,
    mem: MemoryReport,
    cert: AIOSCertification
  ): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // 1-2. General checks
    if (!snapshot.state) {
      issues.push("StabilityState is undefined.");
    }
    if (!snapshot.configuration) {
      issues.push("StabilityConfiguration is undefined.");
    }

    // 3-6. Performance Profiles checks (Startup/Shutdown limits)
    const metrics = perf.metrics;
    if (metrics.startupTimeMs > 5000) {
      issues.push(`Startup boot time exceeded threshold limit (5000ms): ${metrics.startupTimeMs}ms.`);
    }
    if (metrics.shutdownTimeMs > 3000) {
      issues.push(`Shutdown cleanup time exceeded threshold limit (3000ms): ${metrics.shutdownTimeMs}ms.`);
    }
    if (metrics.averageResponseLatencyMs > 2000) {
      issues.push(`Average response latency exceeded threshold (2000ms): ${metrics.averageResponseLatencyMs}ms.`);
    }
    if (metrics.averageSearchLatencyMs > 1000) {
      issues.push(`Average search latency exceeded threshold (1000ms): ${metrics.averageSearchLatencyMs}ms.`);
    }

    // 7-10. Memory Reports checks
    if (mem.leakSuspected) {
      issues.push("Potential memory leak suspected by analyzer.");
    }
    if (mem.growthRatePerMinBytes > 50 * 1024 * 1024) {
      issues.push(`Memory growth rate exceeds 50MB/min: ${mem.growthRatePerMinBytes} bytes/min.`);
    }

    // 11-14. Certification Checklist checks
    const checklist = cert.checklist;
    const requiredChecks = [
      "unit_tests_passed",
      "integration_tests_passed",
      "stress_tests_passed",
      "performance_satisfactory",
      "no_memory_leaks",
      "crash_recovery_verified",
      "documentation_generated"
    ];
    requiredChecks.forEach(check => {
      if (!checklist[check]) {
        issues.push(`Required certification check is failing: ${check}`);
      }
    });

    const isValid = issues.length === 0;
    return { isValid, issues };
  }

  // 15-17. Benchmark validator
  public validateBenchmarks(benchmarks: any[]): void {
    benchmarks.forEach(b => {
      if (b.initTimeMs > 1000) {
        throw new StabilityValidationException(`Engine "${b.engineId}" took too long to initialize (${b.initTimeMs}ms).`);
      }
      if (b.opsPerSec < 10) {
        throw new StabilityValidationException(`Engine "${b.engineId}" performance throughput is below minimum (ops/sec: ${b.opsPerSec}).`);
      }
    });
  }

  // 18-20. State transition rule checking
  public validateStateTransition(current: StabilityState, next: StabilityState): void {
    const validTransitions: Record<StabilityState, StabilityState[]> = {
      [StabilityState.CREATED]: [StabilityState.INITIALIZING, StabilityState.FAILED],
      [StabilityState.INITIALIZING]: [StabilityState.TESTING, StabilityState.FAILED],
      [StabilityState.TESTING]: [StabilityState.PROFILING, StabilityState.FAILED],
      [StabilityState.PROFILING]: [StabilityState.OPTIMIZING, StabilityState.FAILED],
      [StabilityState.OPTIMIZING]: [StabilityState.CERTIFYING, StabilityState.FAILED],
      [StabilityState.CERTIFYING]: [StabilityState.READY, StabilityState.FAILED],
      [StabilityState.READY]: [StabilityState.FAILED],
      [StabilityState.FAILED]: [StabilityState.INITIALIZING]
    };

    if (!validTransitions[current]?.includes(next)) {
      throw new StabilityValidationException(`Invalid stability state transition: ${current} -> ${next}`);
    }
  }
}
