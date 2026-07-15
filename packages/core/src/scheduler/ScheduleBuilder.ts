import { Schedule } from "./Schedule";
import { ScheduleType } from "./ScheduleType";
import { ScheduleTrigger } from "./ScheduleTrigger";
import { SchedulePolicy } from "./SchedulePolicy";
import { SchedulerValidator } from "./SchedulerValidator";

export class ScheduleBuilder {
  private _id?: string;
  private _name?: string;
  private _type?: ScheduleType;
  private _trigger?: ScheduleTrigger;
  private _policy?: SchedulePolicy;
  private _handlerName?: string;
  private _priority = 0;
  private _enabled = true;
  private _metadata: Record<string, unknown> = {};

  public withId(id: string): this {
    this._id = id;
    return this;
  }

  public withName(name: string): this {
    this._name = name;
    return this;
  }

  public withType(type: ScheduleType): this {
    this._type = type;
    return this;
  }

  public withTrigger(trigger: ScheduleTrigger): this {
    this._trigger = trigger;
    return this;
  }

  public withPolicy(policy: SchedulePolicy): this {
    this._policy = policy;
    return this;
  }

  public withHandlerName(handlerName: string): this {
    this._handlerName = handlerName;
    return this;
  }

  public withPriority(priority: number): this {
    this._priority = priority;
    return this;
  }

  public withEnabled(enabled: boolean): this {
    this._enabled = enabled;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public build(): Schedule {
    const schedule: Schedule = {
      id: this._id || "",
      name: this._name || "",
      type: this._type || ScheduleType.ONE_TIME,
      trigger: this._trigger || {},
      policy: this._policy || { maxRetries: 3, backoffMs: 100, concurrencyLimit: 1 },
      handlerName: this._handlerName || "",
      priority: this._priority,
      enabled: this._enabled,
      metadata: { ...this._metadata },
    };

    SchedulerValidator.validateSchedule(schedule);
    return schedule;
  }
}
