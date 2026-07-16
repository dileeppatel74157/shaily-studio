import { ITool } from "./ITool";
import { ToolMetadata } from "./ToolMetadata";
import { ToolContext } from "./ToolContext";
import { ToolState } from "./ToolState";
import { ToolRequest } from "./ToolRequest";
import { ToolResponse } from "./ToolResponse";
import { ToolSnapshot } from "./ToolSnapshot";
import {
  IToolHandler,
  InvalidToolStateException,
  deepFreeze,
} from "./types";
import { ToolValidator } from "./ToolValidator";

export class Tool implements ITool {
  private _state: ToolState = ToolState.CREATED;
  private readonly _validator = new ToolValidator();

  constructor(
    public readonly metadata: ToolMetadata,
    public readonly context: ToolContext,
    private readonly _handler: IToolHandler
  ) {
    deepFreeze(this.metadata);
    Object.freeze(this.context);
  }

  public get state(): ToolState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state !== ToolState.CREATED) {
      throw new InvalidToolStateException("initialize", this._state);
    }

    try {
      if (this._handler.initialize) {
        await this._handler.initialize(this.context);
      }
      this._state = ToolState.READY;
    } catch (err) {
      this._state = ToolState.FAILED;
      throw err;
    }
  }

  public async execute(request: ToolRequest): Promise<ToolResponse> {
    if (this._state !== ToolState.READY) {
      throw new InvalidToolStateException("execute", this._state);
    }

    // Validate request input
    this._validator.validateRequest(request, this.metadata.id);

    this._state = ToolState.RUNNING;
    const startTime = Date.now();

    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "ToolStarted",
        timestamp: new Date(),
        correlationId: request.correlationId || "corr-tool",
        source: "Tool:" + this.metadata.id,
        payload: { toolId: this.metadata.id, input: request.input },
        metadata: {},
      });
    }

    try {
      const response = await this._handler.execute(request, this.context);
      this._state = ToolState.READY;

      // Ensure executionTime is set on the response
      const finalResponse: ToolResponse = {
        success: response.success,
        output: response.output,
        metadata: response.metadata || {},
        executionTime: response.executionTime ?? (Date.now() - startTime),
        error: response.error,
      };

      if (this.context.eventBus) {
        if (finalResponse.success) {
          await this.context.eventBus.publish({
            id: "evt-" + Math.random().toString(36).substring(2, 11),
            name: "ToolCompleted",
            timestamp: new Date(),
            correlationId: request.correlationId || "corr-tool",
            source: "Tool:" + this.metadata.id,
            payload: { toolId: this.metadata.id, output: finalResponse.output },
            metadata: {},
          });
        } else {
          await this.context.eventBus.publish({
            id: "evt-" + Math.random().toString(36).substring(2, 11),
            name: "ToolFailed",
            timestamp: new Date(),
            correlationId: request.correlationId || "corr-tool",
            source: "Tool:" + this.metadata.id,
            payload: { toolId: this.metadata.id, error: finalResponse.error?.message || "Execution failed" },
            metadata: {},
          });
        }
      }

      return deepFreeze(finalResponse);
    } catch (err: any) {
      this._state = ToolState.FAILED;

      const finalResponse: ToolResponse = {
        success: false,
        output: null,
        metadata: {},
        correlationId: request.correlationId,
        executionTime: Date.now() - startTime,
        error: err,
      } as any;

      deepFreeze(finalResponse);

      if (this.context.eventBus) {
        await this.context.eventBus.publish({
          id: "evt-" + Math.random().toString(36).substring(2, 11),
          name: "ToolFailed",
          timestamp: new Date(),
          correlationId: request.correlationId || "corr-tool",
          source: "Tool:" + this.metadata.id,
          payload: { toolId: this.metadata.id, error: err.message },
          metadata: {},
        });
      }

      throw err;
    }
  }

  public async shutdown(): Promise<void> {
    if (this._state !== ToolState.READY) {
      throw new InvalidToolStateException("shutdown", this._state);
    }

    try {
      if (this._handler.shutdown) {
        await this._handler.shutdown(this.context);
      }
      this._state = ToolState.STOPPED;
    } catch (err) {
      this._state = ToolState.FAILED;
      throw err;
    }
  }

  public snapshot(): ToolSnapshot {
    return deepFreeze({
      id: this.metadata.id,
      state: this._state,
      metadata: this.metadata,
      timestamp: new Date(),
    });
  }
}
