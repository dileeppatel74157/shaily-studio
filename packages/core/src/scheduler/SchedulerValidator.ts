import { Schedule } from "./Schedule";
import { ScheduleType } from "./ScheduleType";
import { ScheduleTrigger } from "./ScheduleTrigger";
import { SchedulePolicy } from "./SchedulePolicy";
import { SchedulerContext } from "./SchedulerContext";
import { SchedulerValidationException } from "./types";

export class SchedulerValidator {
  private static readonly ID_REGEX = /^[a-zA-Z0-9_.-]+$/;

  public static validateIdentifier(id: string, name: string): void {
    if (!id || typeof id !== "string" || id.trim() === "") {
      throw new SchedulerValidationException(`${name} identifier must be a non-empty string`);
    }
    if (!this.ID_REGEX.test(id)) {
      throw new SchedulerValidationException(
        `${name} identifier "${id}" contains invalid characters. Only alphanumeric, dots, dashes, and underscores are allowed.`
      );
    }
  }

  public static validateContext(context: SchedulerContext): void {
    if (!context) {
      throw new SchedulerValidationException("SchedulerContext cannot be null or undefined");
    }
    this.validateIdentifier(context.env, "Context environment (env)");
    this.validateIdentifier(context.namespace, "Context namespace");
  }

  public static validateSchedule(schedule: Schedule): void {
    if (!schedule) {
      throw new SchedulerValidationException("Schedule cannot be null or undefined");
    }
    this.validateIdentifier(schedule.id, "Schedule ID");
    
    if (!schedule.name || typeof schedule.name !== "string" || schedule.name.trim() === "") {
      throw new SchedulerValidationException("Schedule name must be a non-empty string");
    }
    
    this.validateIdentifier(schedule.handlerName, "Handler name");

    if (!Object.values(ScheduleType).includes(schedule.type)) {
      throw new SchedulerValidationException(`Invalid schedule type: "${schedule.type}"`);
    }

    if (typeof schedule.priority !== "number" || isNaN(schedule.priority)) {
      throw new SchedulerValidationException(`Schedule "${schedule.id}" priority must be a number`);
    }

    this.validateTrigger(schedule.trigger);
    this.validatePolicy(schedule.policy);
  }

  public static validateTrigger(trigger: ScheduleTrigger): void {
    if (!trigger) {
      throw new SchedulerValidationException("ScheduleTrigger cannot be null or undefined");
    }
    if (trigger.startAt !== undefined && (!(trigger.startAt instanceof Date) || isNaN(trigger.startAt.getTime()))) {
      throw new SchedulerValidationException("Invalid trigger startAt Date");
    }
    if (trigger.intervalMs !== undefined && (typeof trigger.intervalMs !== "number" || trigger.intervalMs <= 0 || isNaN(trigger.intervalMs))) {
      throw new SchedulerValidationException("Trigger intervalMs must be a positive number");
    }
  }

  public static validatePolicy(policy: SchedulePolicy): void {
    if (!policy) {
      throw new SchedulerValidationException("SchedulePolicy cannot be null or undefined");
    }
    if (typeof policy.maxRetries !== "number" || policy.maxRetries < 0 || isNaN(policy.maxRetries)) {
      throw new SchedulerValidationException("Policy maxRetries must be a non-negative number");
    }
    if (typeof policy.backoffMs !== "number" || policy.backoffMs < 0 || isNaN(policy.backoffMs)) {
      throw new SchedulerValidationException("Policy backoffMs must be a non-negative number");
    }
    if (typeof policy.concurrencyLimit !== "number" || policy.concurrencyLimit <= 0 || isNaN(policy.concurrencyLimit)) {
      throw new SchedulerValidationException("Policy concurrencyLimit must be a positive number");
    }
  }
}
