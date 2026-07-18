import { ProductionState }             from "./ProductionState";
import { ValidationState }             from "./ValidationState";
import { CertificationLevel }          from "./CertificationLevel";
import { ProductionValidationException } from "./types";
import type {
  ProductionRequest,
  ProductionSnapshot,
  ValidationReport,
  BenchmarkReport,
} from "./models";

const STATE_TRANSITIONS: Record<ProductionState, ProductionState[]> = {
  [ProductionState.CREATED]:     [ProductionState.INITIALIZED],
  [ProductionState.INITIALIZED]: [ProductionState.RUNNING, ProductionState.FAILED],
  [ProductionState.RUNNING]:     [ProductionState.COMPLETED, ProductionState.FAILED],
  [ProductionState.COMPLETED]:   [ProductionState.INITIALIZED],
  [ProductionState.FAILED]:      [ProductionState.INITIALIZED],
};

export class ProductionReadyValidator {

  // State transitions
  public static validateStateTransition(id: string, from: ProductionState, to: ProductionState): void {
    const allowed = STATE_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new ProductionValidationException(`Invalid state transition for ${id}: ${from} -> ${to}`);
    }
  }

  // Missing engine registrations
  public static validateEngineRegistrations(context: any): void {
    const engines = [
      "researchEngine", "strategyEngine", "channelEngine", "scriptEngine",
      "productionEngine", "generationEngine", "compositionEngine", "renderEngine",
      "qualityEngine", "publishingEngine", "analyticsEngine", "channelManager",
      "founderEngine", "controlCenterEngine", "learningEngine", "optimizationEngine",
      "pipelineEngine",
    ];
    for (const eng of engines) {
      if (!context || !context[eng]) {
        throw new ProductionValidationException(`Missing required production module registration: ${eng}`);
      }
    }
  }

  // Circular service dependencies
  public static validateNoCircularServices(edges: [string, string][]): void {
    const adj = new Map<string, string[]>();
    for (const [from, to] of edges) {
      const list = adj.get(from) ?? [];
      list.push(to);
      adj.set(from, list);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string): boolean => {
      if (recStack.has(node)) return true;
      if (visited.has(node)) return false;

      visited.add(node);
      recStack.add(node);

      const neighbors = adj.get(node) ?? [];
      for (const neighbor of neighbors) {
        if (dfs(neighbor)) return true;
      }

      recStack.delete(node);
      return false;
    };

    for (const node of adj.keys()) {
      if (dfs(node)) {
        throw new ProductionValidationException("Circular dependency detected in core registry services!");
      }
    }
  }

  // Duplicate exports
  public static validateNoDuplicateExports(exports: string[]): void {
    const seen = new Set<string>();
    for (const exp of exports) {
      if (seen.has(exp)) {
        throw new ProductionValidationException(`Duplicate module export detected: ${exp}`);
      }
      seen.add(exp);
    }
  }

  // Missing interfaces
  public static validateRequiredInterfaces(interfaces: string[]): void {
    const required = ["IFounderEngine", "IControlCenterEngine", "ILearningEngine", "IOptimizationEngine", "IPipelineEngine"];
    for (const req of required) {
      if (!interfaces.includes(req)) {
        throw new ProductionValidationException(`Missing required interface implementation contract: ${req}`);
      }
    }
  }

  // Invalid snapshots
  public static validateSnapshotIntegrity(snap: ProductionSnapshot): void {
    if (!snap.id || snap.id.trim() === "") {
      throw new ProductionValidationException("ProductionSnapshot must have a valid ID");
    }
    if (snap.timestamp > new Date(Date.now() + 3600_000)) {
      throw new ProductionValidationException("Snapshot timestamp cannot be in the future");
    }
  }

  // Memory namespace conflicts
  public static validateMemoryNamespaces(namespaces: string[]): void {
    const seen = new Set<string>();
    for (const ns of namespaces) {
      if (seen.has(ns)) {
        throw new ProductionValidationException(`Conflict detected: Memory namespace is registered multiple times: ${ns}`);
      }
      seen.add(ns);
    }
  }

  // Event registration conflicts
  public static validateEventRegistrations(events: string[]): void {
    const seen = new Set<string>();
    for (const evt of events) {
      if (seen.has(evt)) {
        throw new ProductionValidationException(`Conflict detected: Event is registered multiple times: ${evt}`);
      }
      seen.add(evt);
    }
  }

  // Performance thresholds
  public static validatePerformanceThresholds(report: BenchmarkReport): void {
    if (report.metrics.startupTimeMs > 5000) {
      throw new ProductionValidationException(`Startup latency exceeds production threshold: ${report.metrics.startupTimeMs}ms`);
    }
    if (report.metrics.avgMemoryUsageMb > 16384) {
      throw new ProductionValidationException(`Average memory leak threshold exceeded: ${report.metrics.avgMemoryUsageMb}MB`);
    }
  }

  // Request validation
  public static validateRequest(req: ProductionRequest): void {
    if (!req.id || req.id.trim() === "") {
      throw new ProductionValidationException("ProductionRequest must have a valid ID");
    }
  }
}
