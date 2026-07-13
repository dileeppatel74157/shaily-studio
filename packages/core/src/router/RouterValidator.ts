import { RouterRequest } from "./RouterRequest";
import { ModelDescriptor } from "./ModelDescriptor";
import { RouterValidationException } from "./types";

export class RouterValidator {
  public validateRequest(request: RouterRequest): void {
    if (!request.prompt && (!request.messages || request.messages.length === 0)) {
      throw new RouterValidationException(
        "RouterRequest must contain either a prompt or at least one message."
      );
    }
  }

  public validateModel(model: ModelDescriptor): void {
    if (!model.id || model.id.trim() === "") {
      throw new RouterValidationException("Model ID cannot be empty.");
    }
    if (!model.providerId || model.providerId.trim() === "") {
      throw new RouterValidationException("Model Provider ID cannot be empty.");
    }
    if (model.contextWindow <= 0) {
      throw new RouterValidationException("Model context window must be greater than 0.");
    }
  }
}
