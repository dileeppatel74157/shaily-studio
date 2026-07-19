import { ISchedulerEngine } from "./interfaces";
import { SchedulerEngine } from "./SchedulerEngine";
import { SchedulerConfiguration } from "./models";
import { SchedulerValidationException } from "./types";

export class SchedulerBuilder {
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

  public build(): ISchedulerEngine {
    if (!this._context) {
      throw new SchedulerValidationException("SchedulerContext is required to build SchedulerEngine.");
    }

    const config: SchedulerConfiguration = this._config || {
      concurrentLimit: 2,
      checkIntervalMs: 1000,
      persistenceEnabled: false
    };

    return new SchedulerEngine(this._context, config);
  }
}
