import {
  DailyRoutine,
  AutomationTask,
  AutomationExecution,
  AutomationSnapshot,
  AutomationSchedule,
  ExecutionWindow,
  BackupJob
} from "./models";
import { AutomationValidationException } from "./exceptions";
import { RoutineType } from "./RoutineType";
import { AutomationPriority } from "./AutomationPriority";
import { AutomationScheduleType } from "./AutomationScheduleType";

export class DailyAutomationValidator {
  public validate(snapshot: AutomationSnapshot): void {
    if (!snapshot) {
      throw new AutomationValidationException("Snapshot is undefined.");
    }
    
    // 1-2. Stats validation
    if (snapshot.statistics.successRate < 0 || snapshot.statistics.successRate > 100) {
      throw new AutomationValidationException(`Success rate must be between 0 and 100. Got: ${snapshot.statistics.successRate}%`);
    }
    if (snapshot.statistics.failedExecutions < 0) {
      throw new AutomationValidationException(`Failed executions cannot be negative. Got: ${snapshot.statistics.failedExecutions}`);
    }

    // 3. Health check
    if (!["healthy", "unhealthy", "critical"].includes(snapshot.health.status)) {
      throw new AutomationValidationException(`Invalid health status: ${snapshot.health.status}`);
    }

    // 4. Duplicate routines check
    const routineIds = new Set<string>();
    for (const r of snapshot.activeRoutines) {
      if (routineIds.has(r.id)) {
        throw new AutomationValidationException(`Duplicate routine ID detected: ${r.id}`);
      }
      routineIds.add(r.id);
      this.validateRoutine(r);
    }
  }

  // 5-9. Routine Validation
  public validateRoutine(routine: DailyRoutine): void {
    if (!routine.id) {
      throw new AutomationValidationException("Routine ID is required.");
    }
    if (!routine.name) {
      throw new AutomationValidationException(`Routine name is required for routine ${routine.id}.`);
    }
    if (!routine.type || !Object.values(RoutineType).includes(routine.type)) {
      throw new AutomationValidationException(`Invalid routine type: ${routine.type}`);
    }
    if (!routine.priority || !Object.values(AutomationPriority).includes(routine.priority)) {
      throw new AutomationValidationException(`Invalid priority: ${routine.priority}`);
    }
    if (!routine.enabled) {
      // 10. Routine execution check: Warn or validate even if disabled, but execution requires enabled.
    }
    
    this.validateSchedule(routine.schedule);
    
    if (routine.tasks.length === 0) {
      throw new AutomationValidationException(`Routine ${routine.id} must contain at least one task.`);
    }

    // 11. Task dependencies unique
    const taskIds = new Set(routine.tasks.map(t => t.id));
    for (const task of routine.tasks) {
      this.validateTask(task);
      for (const dep of task.dependencies) {
        if (!taskIds.has(dep)) {
          throw new AutomationValidationException(`Task dependency ${dep} not found in task list of routine ${routine.id}.`);
        }
      }
    }

    // 12. Dependency cycle validation
    this.validateDependencyCycle(routine.tasks);
  }

  // 13-14. Schedule Validation
  public validateSchedule(sched: AutomationSchedule): void {
    if (!sched) {
      throw new AutomationValidationException("Schedule configuration is missing.");
    }
    if (!Object.values(AutomationScheduleType).includes(sched.type)) {
      throw new AutomationValidationException(`Invalid schedule type: ${sched.type}`);
    }
    if (sched.type === AutomationScheduleType.Interval && (!sched.intervalMs || sched.intervalMs <= 0)) {
      throw new AutomationValidationException("Interval schedule requires a positive intervalMs.");
    }
    if (sched.type === AutomationScheduleType.Daily && !sched.startTime) {
      throw new AutomationValidationException("Daily schedule requires a startTime.");
    }
  }

  // 15-16. Task Validation
  public validateTask(task: AutomationTask): void {
    if (!task.id) {
      throw new AutomationValidationException("Task ID is required.");
    }
    if (task.retryLimit < 0) {
      throw new AutomationValidationException(`Task retry limit cannot be negative. Got: ${task.retryLimit}`);
    }
    if (task.retryCount < 0 || task.retryCount > task.retryLimit) {
      throw new AutomationValidationException(`Task retry count must be between 0 and retry limit. Got: ${task.retryCount}/${task.retryLimit}`);
    }
  }

  // 17. Cycle Detection using DFS
  public validateDependencyCycle(tasks: AutomationTask[]): void {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    const hasCycle = (id: string): boolean => {
      if (recStack.has(id)) return true;
      if (visited.has(id)) return false;

      visited.add(id);
      recStack.add(id);

      const task = taskMap.get(id);
      if (task) {
        for (const dep of task.dependencies) {
          if (hasCycle(dep)) return true;
        }
      }

      recStack.delete(id);
      return false;
    };

    for (const t of tasks) {
      if (hasCycle(t.id)) {
        throw new AutomationValidationException("Circular dependency detected in tasks.");
      }
    }
  }

  // 18. Backup destination validation
  public validateBackup(job: BackupJob): void {
    if (!job.destination || job.destination.trim() === "") {
      throw new AutomationValidationException("Backup destination path cannot be empty.");
    }
    if (job.sizeBytes < 0) {
      throw new AutomationValidationException(`Backup size cannot be negative. Got: ${job.sizeBytes}`);
    }
  }

  // 19. Execution Window validation
  public validateExecutionWindow(window: ExecutionWindow): void {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(window.startTime)) {
      throw new AutomationValidationException(`Invalid start time format (HH:MM required): ${window.startTime}`);
    }
    if (!timeRegex.test(window.endTime)) {
      throw new AutomationValidationException(`Invalid end time format (HH:MM required): ${window.endTime}`);
    }
  }

  // 20. Execution validation
  public validateExecution(exec: AutomationExecution): void {
    if (exec.tasksCompletedCount < 0 || exec.totalTasksCount < 0) {
      throw new AutomationValidationException("Execution task counts cannot be negative.");
    }
    if (exec.tasksCompletedCount > exec.totalTasksCount) {
      throw new AutomationValidationException(`Completed count (${exec.tasksCompletedCount}) cannot exceed total tasks count (${exec.totalTasksCount}).`);
    }
  }
}
