import { RuntimeState } from "./RuntimeState";
import { EngineState } from "./EngineState";
import { ServiceType } from "./ServiceType";
import { HealthStatus } from "./HealthStatus";
import { StartupPriority } from "./StartupPriority";
import { SchedulerState } from "./SchedulerState";
import { HeartbeatStatus } from "./HeartbeatStatus";
import {
  RuntimeValidationException,
  InvalidRuntimeStateException,
  DependencyException,
  SchedulerException,
  HealthCheckException,
  StartupException
} from "./types";
import {
  RuntimeConfiguration,
  EngineRegistration,
  ServiceRegistration,
  SchedulerJob,
  Heartbeat,
  HealthCheck,
  RuntimeSnapshot
} from "./models";

export class RuntimeValidator {
  /**
   * 1. Validate Context format.
   */
  public static validateContext(context: any): void {
    if (!context) {
      throw new RuntimeValidationException("Runtime context is missing");
    }
    if (typeof context.env !== "string" || !context.env) {
      throw new RuntimeValidationException("Context env must be a non-empty string");
    }
    if (typeof context.namespace !== "string" || !context.namespace) {
      throw new RuntimeValidationException("Context namespace must be a non-empty string");
    }
  }

  /**
   * 2. Validate Runtime Configuration.
   */
  public static validateRuntimeConfig(config: RuntimeConfiguration): void {
    if (!config) {
      throw new RuntimeValidationException("Runtime configuration is missing");
    }
    if (typeof config.env !== "string" || !config.env) {
      throw new RuntimeValidationException("Configuration env is required");
    }
    if (typeof config.heartbeatIntervalMs !== "number" || config.heartbeatIntervalMs <= 0) {
      throw new RuntimeValidationException("heartbeatIntervalMs must be a positive number");
    }
    if (typeof config.healthCheckIntervalMs !== "number" || config.healthCheckIntervalMs <= 0) {
      throw new RuntimeValidationException("healthCheckIntervalMs must be a positive number");
    }
    if (typeof config.startupTimeoutMs !== "number" || config.startupTimeoutMs <= 0) {
      throw new RuntimeValidationException("startupTimeoutMs must be a positive number");
    }
    if (typeof config.shutdownTimeoutMs !== "number" || config.shutdownTimeoutMs <= 0) {
      throw new RuntimeValidationException("shutdownTimeoutMs must be a positive number");
    }
  }

  /**
   * 3. Validate Runtime State Transition.
   */
  public static validateStateTransition(current: RuntimeState, target: RuntimeState): void {
    const allowed: Record<RuntimeState, RuntimeState[]> = {
      [RuntimeState.CREATED]: [RuntimeState.INITIALIZING, RuntimeState.FAILED],
      [RuntimeState.INITIALIZING]: [RuntimeState.STARTING, RuntimeState.FAILED],
      [RuntimeState.STARTING]: [RuntimeState.RUNNING, RuntimeState.FAILED],
      [RuntimeState.RUNNING]: [RuntimeState.PAUSED, RuntimeState.STOPPING, RuntimeState.FAILED],
      [RuntimeState.PAUSED]: [RuntimeState.RUNNING, RuntimeState.STOPPING, RuntimeState.FAILED],
      [RuntimeState.STOPPING]: [RuntimeState.STOPPED, RuntimeState.FAILED],
      [RuntimeState.STOPPED]: [RuntimeState.INITIALIZING, RuntimeState.STARTING, RuntimeState.FAILED],
      [RuntimeState.FAILED]: [RuntimeState.INITIALIZING, RuntimeState.STARTING, RuntimeState.STOPPING, RuntimeState.STOPPED, RuntimeState.FAILED]
    };

    if (!allowed[current].includes(target)) {
      throw new InvalidRuntimeStateException(`transition from ${current} to ${target}`, current);
    }
  }

  /**
   * 4. Validate Identifier has no spaces/illegal characters.
   */
  public static validateIdentifier(id: string, label: string): void {
    if (!id || typeof id !== "string") {
      throw new RuntimeValidationException(`${label} must be a non-empty string`);
    }
    const regex = /^[a-zA-Z0-9_\-]+$/;
    if (!regex.test(id)) {
      throw new RuntimeValidationException(`${label} "${id}" contains illegal characters or spaces.`);
    }
  }

  /**
   * 5. Validate Engine ID Uniqueness.
   */
  public static validateEngineIdUnique(id: string, existing: Set<string> | Map<string, any>): void {
    const hasId = existing instanceof Set ? existing.has(id) : existing.has(id);
    if (hasId) {
      throw new RuntimeValidationException(`Engine with ID "${id}" is already registered.`);
    }
  }

  /**
   * 6. Validate Service ID Uniqueness.
   */
  public static validateServiceIdUnique(id: string, existing: Set<string> | Map<string, any>): void {
    const hasId = existing instanceof Set ? existing.has(id) : existing.has(id);
    if (hasId) {
      throw new RuntimeValidationException(`Service with ID "${id}" is already registered.`);
    }
  }

  /**
   * 7. Validate Engine Registration payload format.
   */
  public static validateEngineRegistration(registration: EngineRegistration): void {
    if (!registration) {
      throw new RuntimeValidationException("Engine registration is missing");
    }
    this.validateIdentifier(registration.id, "Engine ID");
    if (!registration.engine) {
      throw new RuntimeValidationException(`Engine instance is missing for registration "${registration.id}"`);
    }
    if (!Array.isArray(registration.dependencies)) {
      throw new RuntimeValidationException(`Dependencies must be an array for engine "${registration.id}"`);
    }
    if (!Object.values(StartupPriority).includes(registration.priority)) {
      throw new RuntimeValidationException(`Invalid priority "${registration.priority}" for engine "${registration.id}"`);
    }
  }

  /**
   * 8. Validate Service Registration payload format.
   */
  public static validateServiceRegistration(registration: ServiceRegistration): void {
    if (!registration) {
      throw new RuntimeValidationException("Service registration is missing");
    }
    this.validateIdentifier(registration.id, "Service ID");
    if (!registration.service) {
      throw new RuntimeValidationException(`Service instance is missing for registration "${registration.id}"`);
    }
    if (!Object.values(ServiceType).includes(registration.type)) {
      throw new RuntimeValidationException(`Invalid service type "${registration.type}" for service "${registration.id}"`);
    }
  }

  /**
   * 9. Validate Engine Dependencies Exist in Registered list.
   */
  public static validateDependenciesExist(registration: EngineRegistration, registeredIds: Set<string>): void {
    for (const dep of registration.dependencies) {
      if (!registeredIds.has(dep)) {
        throw new DependencyException(`Engine "${registration.id}" depends on missing engine "${dep}"`);
      }
    }
  }

  /**
   * 10. Validate Circular Engine Dependencies (cycle detection).
   */
  public static validateCircularDependencies(registrations: EngineRegistration[]): void {
    const adj = new Map<string, string[]>();
    for (const r of registrations) {
      adj.set(r.id, r.dependencies);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string) => {
      visited.add(node);
      recStack.add(node);

      const neighbors = adj.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true; // cycle detected
        }
      }

      recStack.delete(node);
      return false;
    };

    for (const r of registrations) {
      if (!visited.has(r.id)) {
        if (dfs(r.id)) {
          throw new DependencyException("Circular engine dependency detected in runtime configuration.");
        }
      }
    }
  }

  /**
   * 11. Validate Startup Order based on topological sort constraint.
   */
  public static validateStartupOrder(order: string[], registrations: EngineRegistration[]): void {
    const positionMap = new Map<string, number>();
    order.forEach((id, index) => positionMap.set(id, index));

    for (const r of registrations) {
      const parentPos = positionMap.get(r.id);
      if (parentPos === undefined) {
        throw new StartupException(`Engine "${r.id}" is missing from startup sequence.`);
      }
      for (const dep of r.dependencies) {
        const depPos = positionMap.get(dep);
        if (depPos === undefined) {
          throw new StartupException(`Dependency "${dep}" of engine "${r.id}" is missing from startup sequence.`);
        }
        if (depPos > parentPos) {
          throw new StartupException(`Invalid startup order: "${dep}" must start before "${r.id}".`);
        }
      }
    }
  }

  /**
   * 12. Validate Scheduler Job ID Uniqueness.
   */
  public static validateJobIdUnique(jobId: string, existingJobs: Set<string> | string[]): void {
    const hasJob = existingJobs instanceof Set ? existingJobs.has(jobId) : existingJobs.includes(jobId);
    if (hasJob) {
      throw new SchedulerException(`Job with ID "${jobId}" is already scheduled.`);
    }
  }

  /**
   * 13. Validate Scheduler Job format.
   */
  public static validateSchedulerJob(job: SchedulerJob): void {
    if (!job) {
      throw new SchedulerException("Scheduler job is missing");
    }
    this.validateIdentifier(job.id, "Job ID");
    if (job.intervalMs === undefined && job.cronExpression === undefined) {
      throw new SchedulerException(`Job "${job.id}" must define either intervalMs or cronExpression.`);
    }
    if (job.intervalMs !== undefined && (typeof job.intervalMs !== "number" || job.intervalMs <= 0)) {
      throw new SchedulerException(`Job "${job.id}" intervalMs must be a positive number.`);
    }
    if (job.cronExpression !== undefined) {
      this.validateCronExpression(job.cronExpression, job.id);
    }
    if (typeof job.task !== "function") {
      throw new SchedulerException(`Job "${job.id}" must define a valid executable task function.`);
    }
    if (!Object.values(StartupPriority).includes(job.priority)) {
      throw new SchedulerException(`Invalid priority "${job.priority}" for job "${job.id}".`);
    }
  }

  /**
   * 14. Validate Cron Expression format (must have 5 or 6 whitespace-separated tokens).
   */
  public static validateCronExpression(cron: string, jobId: string): void {
    if (typeof cron !== "string" || !cron) {
      throw new SchedulerException(`Job "${jobId}" cronExpression must be a non-empty string.`);
    }
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5 || parts.length > 6) {
      throw new SchedulerException(`Job "${jobId}" has an invalid cron expression: "${cron}". Must have 5 or 6 fields.`);
    }
  }

  /**
   * 15. Validate Health Check payload.
   */
  public static validateHealthCheck(check: HealthCheck): void {
    if (!check) {
      throw new HealthCheckException("Health check payload is missing");
    }
    this.validateIdentifier(check.id, "Health Check ID");
    this.validateIdentifier(check.targetId, "Health Check Target ID");
    if (!Object.values(HealthStatus).includes(check.status)) {
      throw new HealthCheckException(`Invalid health status "${check.status}" in health check "${check.id}"`);
    }
    this.validateHealthScore(check.score);
  }

  /**
   * 16. Validate Health Score.
   */
  public static validateHealthScore(score: number): void {
    if (typeof score !== "number" || score < 0 || score > 100) {
      throw new HealthCheckException(`Invalid health score: ${score}. Must be a number between 0 and 100.`);
    }
  }

  /**
   * 17. Validate Heartbeat payload.
   */
  public static validateHeartbeat(heartbeat: Heartbeat): void {
    if (!heartbeat) {
      throw new HealthCheckException("Heartbeat payload is missing");
    }
    this.validateIdentifier(heartbeat.engineId, "Heartbeat Engine ID");
    if (!Object.values(HeartbeatStatus).includes(heartbeat.status)) {
      throw new HealthCheckException(`Invalid heartbeat status "${heartbeat.status}" for engine "${heartbeat.engineId}"`);
    }
    if (!(heartbeat.timestamp instanceof Date) || isNaN(heartbeat.timestamp.getTime())) {
      throw new HealthCheckException(`Invalid heartbeat timestamp for engine "${heartbeat.engineId}"`);
    }
  }

  /**
   * 18. Validate Heartbeat Timeout detection.
   */
  public static validateHeartbeatTimeout(lastHeartbeat: Date, intervalMs: number, toleranceMs = 2000): boolean {
    const delay = Date.now() - lastHeartbeat.getTime();
    return delay > (intervalMs + toleranceMs);
  }

  /**
   * 19. Validate Engine State Transition.
   */
  public static validateEngineStateTransition(current: EngineState, target: EngineState): void {
    const allowed: Record<EngineState, EngineState[]> = {
      [EngineState.REGISTERED]: [EngineState.INITIALIZED, EngineState.FAILED],
      [EngineState.INITIALIZED]: [EngineState.STARTING, EngineState.FAILED],
      [EngineState.STARTING]: [EngineState.RUNNING, EngineState.FAILED],
      [EngineState.RUNNING]: [EngineState.STOPPED, EngineState.FAILED],
      [EngineState.STOPPED]: [EngineState.STARTING, EngineState.INITIALIZED, EngineState.FAILED],
      [EngineState.FAILED]: [EngineState.REGISTERED, EngineState.INITIALIZED, EngineState.STARTING, EngineState.RUNNING, EngineState.STOPPED, EngineState.FAILED]
    };
    if (!allowed[current].includes(target)) {
      throw new RuntimeValidationException(`Cannot transition engine state from ${current} to ${target}`);
    }
  }

  /**
   * 20. Validate Snapshot Immutability.
   */
  public static validateSnapshotImmutability(snapshot: RuntimeSnapshot): void {
    if (!snapshot) {
      throw new RuntimeValidationException("Snapshot is missing");
    }
    if (!Object.isFrozen(snapshot)) {
      throw new RuntimeValidationException("Snapshot object is not frozen.");
    }
    if (snapshot.metrics && !Object.isFrozen(snapshot.metrics)) {
      throw new RuntimeValidationException("Snapshot metrics object is not frozen.");
    }
    if (snapshot.health && !Object.isFrozen(snapshot.health)) {
      throw new RuntimeValidationException("Snapshot health object is not frozen.");
    }
    if (snapshot.engines && (!Object.isFrozen(snapshot.engines) || snapshot.engines.some(e => !Object.isFrozen(e)))) {
      throw new RuntimeValidationException("Snapshot engines array or engines descriptors are not frozen.");
    }
    if (snapshot.services && (!Object.isFrozen(snapshot.services) || snapshot.services.some(s => !Object.isFrozen(s)))) {
      throw new RuntimeValidationException("Snapshot services array or services descriptors are not frozen.");
    }
    if (snapshot.scheduler && (!Object.isFrozen(snapshot.scheduler) || !Object.isFrozen(snapshot.scheduler.activeJobs))) {
      throw new RuntimeValidationException("Snapshot scheduler report is not frozen.");
    }
  }
}
