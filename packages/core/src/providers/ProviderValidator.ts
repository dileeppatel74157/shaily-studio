import { ProviderRequest } from "./ProviderRequest";
import { ProviderResponse } from "./ProviderResponse";
import { IProvider } from "./IProvider";
import { ProviderFeature } from "./ProviderFeature";
import { ProviderValidationException } from "./types";

export class ProviderValidator {
  public static validateRequest(request: ProviderRequest, provider: IProvider): void {
    if (!request) {
      throw new ProviderValidationException("Request cannot be null or undefined.");
    }
    if (request.requestId !== undefined) {
      this.validateIdentifier(request.requestId, "Request ID");
    }
    if (request.providerId !== undefined) {
      this.validateIdentifier(request.providerId, "Provider ID");
    }
    if (request.model !== undefined) {
      this.validateModelName(request.model, "Model Name");
    }

    if (request.providerId !== undefined && request.providerId !== provider.id) {
      throw new ProviderValidationException(
        `Request provider ID "${request.providerId}" does not match target provider ID "${provider.id}".`
      );
    }

    if (request.messages !== undefined && !Array.isArray(request.messages)) {
      throw new ProviderValidationException("Messages must be an array.");
    }


    // Verify capability compatibility
    if (request.stream && !provider.capabilities.includes(ProviderFeature.Streaming)) {
      throw new ProviderValidationException(
        `Provider "${provider.id}" does not support Streaming capability, but request has stream enabled.`
      );
    }
    if (request.tools && request.tools.length > 0 && !provider.capabilities.includes(ProviderFeature.Tools) && !provider.capabilities.includes(ProviderFeature.FunctionCalling)) {
      throw new ProviderValidationException(
        `Provider "${provider.id}" does not support Tools/FunctionCalling capability, but request includes tools.`
      );
    }
  }

  public static validateResponse(response: ProviderResponse, provider: IProvider): void {
    if (!response) {
      throw new ProviderValidationException("Response cannot be null or undefined.");
    }
    if (response.responseId !== undefined) {
      this.validateIdentifier(response.responseId, "Response ID");
    }
    if (response.providerId !== undefined) {
      this.validateIdentifier(response.providerId, "Provider ID");
    }
    if (response.model !== undefined) {
      this.validateModelName(response.model, "Model Name");
    }

    if (response.providerId !== undefined && response.providerId !== provider.id) {
      throw new ProviderValidationException(
        `Response provider ID "${response.providerId}" does not match target provider ID "${provider.id}".`
      );
    }

    if (response.content !== undefined && typeof response.content !== "string") {
      throw new ProviderValidationException("Response content must be a string.");
    }

    if (response.latency < 0) {
      throw new ProviderValidationException("Response latency cannot be negative.");
    }
  }


  public static validateIdentifier(id: string, name: string): void {
    if (!id || id.trim() === "") {
      throw new ProviderValidationException(`${name} identifier cannot be empty.`);
    }
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(id)) {
      throw new ProviderValidationException(
        `${name} identifier "${id}" must contain only alphanumeric characters, underscores, dashes, or dots.`
      );
    }
  }

  public static validateModelName(model: string, name: string): void {
    if (!model || model.trim() === "") {
      throw new ProviderValidationException(`${name} cannot be empty.`);
    }
    if (!/^[a-zA-Z0-9_\-\.\:\/]+$/.test(model)) {
      throw new ProviderValidationException(
        `${name} "${model}" contains invalid characters.`
      );
    }
  }
}
