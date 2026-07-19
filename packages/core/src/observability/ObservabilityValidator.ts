import { ObservabilitySnapshot } from "./models";
import { ObservabilityState } from "./ObservabilityState";
import { ObservabilityValidationException } from "./types";

export class ObservabilityValidator {
  public validate(snapshot: ObservabilitySnapshot): void {
    const config = snapshot.configuration;
    
    // 1-3. Config bounds checks
    if (config.cpuThresholdPercent <= 0 || config.cpuThresholdPercent > 100) {
      throw new ObservabilityValidationException(`CPU Threshold is out of bounds: ${config.cpuThresholdPercent}%.`);
    }
    if (config.memoryThresholdPercent <= 0 || config.memoryThresholdPercent > 100) {
      throw new ObservabilityValidationException(`Memory Threshold is out of bounds: ${config.memoryThresholdPercent}%.`);
    }

    // 4-6. Log size limits checks
    if (config.maxLogFileSizeMb <= 0 || config.maxLogFileSizeMb > 500) {
      throw new ObservabilityValidationException(`Log file size limits out of bounds: ${config.maxLogFileSizeMb}MB.`);
    }
    if (!config.logFileDirectory) {
      throw new ObservabilityValidationException("Log directory path is empty.");
    }

    // 7-9. Alert rules validation checks
    if (config.alertEmails.length === 0) {
      throw new ObservabilityValidationException("Alert contact emails list is empty.");
    }
    config.alertEmails.forEach(email => {
      if (!email.includes("@")) {
        throw new ObservabilityValidationException(`Invalid alert email address: ${email}`);
      }
    });
  }

  // 10-14. Span validation checks
  public validateSpan(operationName: string, spanId: string): void {
    if (!operationName) {
      throw new ObservabilityValidationException("Trace span operation name is required.");
    }
    if (!spanId) {
      throw new ObservabilityValidationException("Trace span ID is required.");
    }
  }

  // 15-17. Log levels structure check
  public validateLogLevelMessage(message: string): void {
    if (!message || message.trim() === "") {
      throw new ObservabilityValidationException("Log message cannot be empty.");
    }
  }

  // 18-20. State machine transitions checks
  public validateStateTransition(current: ObservabilityState, next: ObservabilityState): void {
    const validTransitions: Record<ObservabilityState, ObservabilityState[]> = {
      [ObservabilityState.CREATED]: [ObservabilityState.INITIALIZING, ObservabilityState.FAILED],
      [ObservabilityState.INITIALIZING]: [ObservabilityState.RUNNING, ObservabilityState.FAILED],
      [ObservabilityState.RUNNING]: [ObservabilityState.STOPPING, ObservabilityState.FAILED],
      [ObservabilityState.STOPPING]: [ObservabilityState.STOPPED, ObservabilityState.FAILED],
      [ObservabilityState.STOPPED]: [ObservabilityState.INITIALIZING],
      [ObservabilityState.FAILED]: [ObservabilityState.INITIALIZING]
    };

    if (!validTransitions[current]?.includes(next)) {
      throw new ObservabilityValidationException(`Invalid observability state transition: ${current} -> ${next}`);
    }
  }
}
