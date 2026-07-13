import { OrchestratorRequest } from "./OrchestratorRequest";
import { OrchestratorValidationException } from "./types";

export class ExecutionValidator {
  public validateRequest(request: OrchestratorRequest): void {
    if (!request.requestId || request.requestId.trim() === "") {
      throw new OrchestratorValidationException("Request ID cannot be empty.");
    }
    if (!request.taskName || request.taskName.trim() === "") {
      throw new OrchestratorValidationException("Task name cannot be empty.");
    }
  }
}
