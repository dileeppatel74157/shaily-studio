import {
  GenerationRequest,
  GenerationResponse,
  GenerationTask,
  GeneratedAsset,
  GenerationQueue,
  QueueBatch,
} from "./models";
import { GenerationState } from "./GenerationState";
import { GenerationType } from "./GenerationType";
import { GenerationProviderType } from "./GenerationProviderType";
import {
  GenerationValidationException,
  DuplicateGenerationException,
} from "./types";

export class GenerationValidator {
  // ─── Request Validation ───────────────────────────────────────────────────

  public static validateRequest(request: GenerationRequest): void {
    if (!request.id || request.id.trim().length === 0) {
      throw new GenerationValidationException("GenerationRequest must have a non-empty ID.");
    }
    if (!request.tasks || request.tasks.length === 0) {
      throw new GenerationValidationException(
        `GenerationRequest "${request.id}" must contain at least one task.`
      );
    }

    // Validate each task
    const seenIds = new Set<string>();
    for (const task of request.tasks) {
      GenerationValidator.validateTask(task);
      if (seenIds.has(task.id)) {
        throw new DuplicateGenerationException(task.id);
      }
      seenIds.add(task.id);
    }

    // Circular dependency check across all tasks
    GenerationValidator.validateNoCycles(request.tasks);
  }

  // ─── Task Validation ──────────────────────────────────────────────────────

  public static validateTask(task: GenerationTask): void {
    if (!task.id || task.id.trim().length === 0) {
      throw new GenerationValidationException("GenerationTask must have a non-empty ID.");
    }
    if (!task.prompt || task.prompt.trim().length < 3) {
      throw new GenerationValidationException(
        `Task "${task.id}" has an invalid prompt. Prompts must be at least 3 characters.`
      );
    }
    if (!Object.values(GenerationType).includes(task.type)) {
      throw new GenerationValidationException(
        `Task "${task.id}" has unsupported GenerationType: "${task.type}".`
      );
    }
    if (!Object.values(GenerationProviderType).includes(task.provider)) {
      throw new GenerationValidationException(
        `Task "${task.id}" references unsupported provider: "${task.provider}".`
      );
    }
  }

  // ─── Circular Dependency Detection (DFS) ─────────────────────────────────

  public static validateNoCycles(tasks: GenerationTask[]): void {
    const graph = new Map<string, string[]>();
    for (const task of tasks) {
      graph.set(task.id, task.dependsOn || []);
    }

    const visited = new Set<string>();
    const inStack = new Set<string>();

    const dfs = (nodeId: string): void => {
      if (inStack.has(nodeId)) {
        throw new GenerationValidationException(
          `Circular dependency detected involving task "${nodeId}".`
        );
      }
      if (visited.has(nodeId)) return;
      inStack.add(nodeId);
      visited.add(nodeId);
      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        dfs(neighbor);
      }
      inStack.delete(nodeId);
    };

    for (const task of tasks) {
      if (!visited.has(task.id)) {
        dfs(task.id);
      }
    }
  }

  // ─── Queue Validation ─────────────────────────────────────────────────────

  public static validateQueue(queue: GenerationQueue, tasks: GenerationTask[]): void {
    if (!queue.id || queue.id.trim().length === 0) {
      throw new GenerationValidationException("GenerationQueue must have a non-empty ID.");
    }
    if (!queue.batches || queue.batches.length === 0) {
      throw new GenerationValidationException("GenerationQueue must have at least one batch.");
    }

    const taskMap = new Map<string, GenerationTask>(tasks.map((t) => [t.id, t]));

    // Validate that each batch's tasks' dependencies appear in earlier batches
    const processedTaskIds = new Set<string>();
    for (const batch of queue.batches) {
      for (const taskId of batch.taskIds) {
        const task = taskMap.get(taskId);
        if (!task) continue;
        for (const depId of task.dependsOn) {
          if (!processedTaskIds.has(depId)) {
            throw new GenerationValidationException(
              `Queue ordering error: task "${taskId}" depends on "${depId}" which has not been scheduled in a prior batch.`
            );
          }
        }
      }
      batch.taskIds.forEach((id) => processedTaskIds.add(id));
    }
  }

  // ─── Response Validation ──────────────────────────────────────────────────

  public static validateResponse(response: GenerationResponse): void {
    if (!response.id || response.id.trim().length === 0) {
      throw new GenerationValidationException("GenerationResponse must have a non-empty ID.");
    }
    if (!response.assets || response.assets.length === 0) {
      throw new GenerationValidationException(
        `GenerationResponse "${response.id}" must contain at least one generated asset.`
      );
    }

    // Check for duplicate asset IDs
    const assetIds = response.assets.map((a) => a.id);
    const uniqueIds = new Set(assetIds);
    if (uniqueIds.size !== assetIds.length) {
      throw new GenerationValidationException(
        `GenerationResponse "${response.id}" contains duplicate asset IDs.`
      );
    }
  }

  // ─── Version Validation ───────────────────────────────────────────────────

  public static validateVersionState(assetId: string, newState: string, validStates: string[]): void {
    if (!validStates.includes(newState)) {
      throw new GenerationValidationException(
        `Invalid version state "${newState}" for asset "${assetId}". Valid states: ${validStates.join(", ")}.`
      );
    }
  }
}
