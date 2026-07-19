import { ITaskSchedulerEngine } from "./interfaces";
import { TaskSchedulerEngine } from "./TaskSchedulerEngine";
import { SchedulerConfiguration } from "./models";
import { TaskSchedulerValidationException } from "./types";

export class TaskSchedulerBuilder {
  private _context?: any;
  private _config?: SchedulerConfiguration;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withConfig(config: SchedulerConfiguration): this {
    this._config = config;
    return this;
  }

  public build(): ITaskSchedulerEngine {
    if (!this._context) {
      throw new TaskSchedulerValidationException("SchedulerContext is required to build TaskSchedulerEngine.");
    }

    const config: SchedulerConfiguration = this._config || {
      concurrentLimit: 2,
      checkIntervalMs: 1000,
      persistenceEnabled: false
    };

    return new TaskSchedulerEngine(this._context, config);
  }
}
