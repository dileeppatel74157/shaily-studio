import { SettingsConfiguration, ValidationIssue, ValidationReport } from "./models";
import { SettingsCategory } from "./SettingsCategory";
import { ValidationSeverity } from "./ValidationSeverity";
import { SettingsState } from "./SettingsState";
import { SettingsValidationException } from "./types";

export class SettingsValidator {
  public validate(config: SettingsConfiguration): ValidationReport {
    const issues: ValidationIssue[] = [];

    // 1. Version Check
    if (!config.version) {
      issues.push({
        category: SettingsCategory.GENERAL,
        field: "version",
        message: "Configuration version is missing.",
        severity: ValidationSeverity.ERROR
      });
    }

    // 2-3. API Keys Validation
    config.apiKeys.forEach((key, index) => {
      if (!key.id) {
        issues.push({
          category: SettingsCategory.API_KEYS,
          field: `apiKeys[${index}].id`,
          message: "API key ID is required.",
          severity: ValidationSeverity.ERROR
        });
      }
      if (key.enabled && !key.value) {
        issues.push({
          category: SettingsCategory.API_KEYS,
          field: `apiKeys[${index}].value`,
          message: `API key for provider ${key.provider} is enabled but empty.`,
          severity: ValidationSeverity.CRITICAL
        });
      }
    });

    // 4-6. Providers Validation
    const seenProviders = new Set<string>();
    config.providers.forEach((prov, index) => {
      if (seenProviders.has(prov.providerType)) {
        issues.push({
          category: SettingsCategory.PROVIDERS,
          field: `providers[${index}].providerType`,
          message: `Duplicate provider configuration for: ${prov.providerType}.`,
          severity: ValidationSeverity.WARNING
        });
      }
      seenProviders.add(prov.providerType);

      if (prov.timeoutMs < 0) {
        issues.push({
          category: SettingsCategory.PROVIDERS,
          field: `providers[${index}].timeoutMs`,
          message: `Timeout cannot be negative for provider: ${prov.providerType}.`,
          severity: ValidationSeverity.ERROR
        });
      }
      if (prov.priority < 0) {
        issues.push({
          category: SettingsCategory.PROVIDERS,
          field: `providers[${index}].priority`,
          message: `Priority cannot be negative for provider: ${prov.providerType}.`,
          severity: ValidationSeverity.ERROR
        });
      }
      if (prov.rateLimitPerMinute <= 0) {
        issues.push({
          category: SettingsCategory.PROVIDERS,
          field: `providers[${index}].rateLimitPerMinute`,
          message: `Rate limit must be greater than zero for provider: ${prov.providerType}.`,
          severity: ValidationSeverity.WARNING
        });
      }
    });

    // 7-9. Model Routing Rules
    config.routingRules.forEach((rule, index) => {
      if (!rule.modelPattern) {
        issues.push({
          category: SettingsCategory.MODELS,
          field: `routingRules[${index}].modelPattern`,
          message: "Routing rule model pattern is empty.",
          severity: ValidationSeverity.ERROR
        });
      }
      if (!rule.preferredProvider) {
        issues.push({
          category: SettingsCategory.MODELS,
          field: `routingRules[${index}].preferredProvider`,
          message: "Routing rule preferred provider is required.",
          severity: ValidationSeverity.ERROR
        });
      }
      if (rule.preferredProvider === rule.fallbackProvider) {
        issues.push({
          category: SettingsCategory.MODELS,
          field: `routingRules[${index}].fallbackProvider`,
          message: `Fallback provider matches preferred provider (${rule.preferredProvider}) in routing rule.`,
          severity: ValidationSeverity.WARNING
        });
      }
    });

    // 10-12. GPU Settings Validation
    const gpu = config.gpu;
    if (gpu.gpuEnabled) {
      if (!gpu.deviceSelection) {
        issues.push({
          category: SettingsCategory.GPU,
          field: "gpu.deviceSelection",
          message: "GPU device selection is required when hardware acceleration is enabled.",
          severity: ValidationSeverity.ERROR
        });
      }
      if (gpu.vramLimitGb <= 0) {
        issues.push({
          category: SettingsCategory.GPU,
          field: "gpu.vramLimitGb",
          message: "VRAM allocation limit must be greater than zero.",
          severity: ValidationSeverity.ERROR
        });
      }
      if (gpu.batchSize < 1) {
        issues.push({
          category: SettingsCategory.GPU,
          field: "gpu.batchSize",
          message: "GPU execution batch size must be at least 1.",
          severity: ValidationSeverity.ERROR
        });
      }
      if (gpu.concurrentGenerationsLimit < 1) {
        issues.push({
          category: SettingsCategory.GPU,
          field: "gpu.concurrentGenerationsLimit",
          message: "GPU concurrent generations limit must be at least 1.",
          severity: ValidationSeverity.WARNING
        });
      }
    }

    // 13-15. Render Settings Validation
    const render = config.render;
    if (!render.resolution || !/^\d+x\d+$/.test(render.resolution)) {
      issues.push({
        category: SettingsCategory.RENDER,
        field: "render.resolution",
        message: "Render resolution must be in 'WIDTHxHEIGHT' format (e.g. 1920x1080).",
        severity: ValidationSeverity.ERROR
      });
    }
    if (render.fps <= 0 || render.fps > 240) {
      issues.push({
        category: SettingsCategory.RENDER,
        field: "render.fps",
        message: "Render FPS must be between 1 and 240.",
        severity: ValidationSeverity.ERROR
      });
    }
    if (render.bitrateKbps <= 0) {
      issues.push({
        category: SettingsCategory.RENDER,
        field: "render.bitrateKbps",
        message: "Video bitrate must be positive.",
        severity: ValidationSeverity.ERROR
      });
    }
    if (render.audioBitrateKbps < 64 || render.audioBitrateKbps > 512) {
      issues.push({
        category: SettingsCategory.RENDER,
        field: "render.audioBitrateKbps",
        message: "Audio bitrate should be between 64kbps and 512kbps.",
        severity: ValidationSeverity.WARNING
      });
    }

    // 16-17. Theme Validation
    const theme = config.theme;
    if (theme.fontSize < 8 || theme.fontSize > 32) {
      issues.push({
        category: SettingsCategory.THEME,
        field: "theme.fontSize",
        message: "Theme font size must be between 8pt and 32pt.",
        severity: ValidationSeverity.WARNING
      });
    }
    if (theme.sidebarWidthPx < 100 || theme.sidebarWidthPx > 600) {
      issues.push({
        category: SettingsCategory.THEME,
        field: "theme.sidebarWidthPx",
        message: "Theme sidebar width must be between 100px and 600px.",
        severity: ValidationSeverity.WARNING
      });
    }

    // 18-20. Backup Configuration
    const backup = config.backup;
    if (backup.backupEnabled) {
      if (!backup.backupDirectory) {
        issues.push({
          category: SettingsCategory.BACKUP,
          field: "backup.backupDirectory",
          message: "Backup directory is required when backups are enabled.",
          severity: ValidationSeverity.ERROR
        });
      }
      if (backup.retentionCount <= 0) {
        issues.push({
          category: SettingsCategory.BACKUP,
          field: "backup.retentionCount",
          message: "Backup retention count must be at least 1.",
          severity: ValidationSeverity.ERROR
        });
      }
    }

    const isValid = !issues.some(issue => issue.severity === ValidationSeverity.ERROR || issue.severity === ValidationSeverity.CRITICAL);

    return {
      timestamp: new Date(),
      isValid,
      issues
    };
  }

  public validateStateTransition(current: SettingsState, next: SettingsState): void {
    const validTransitions: Record<SettingsState, SettingsState[]> = {
      [SettingsState.CREATED]: [SettingsState.INITIALIZING, SettingsState.FAILED],
      [SettingsState.INITIALIZING]: [SettingsState.READY, SettingsState.FAILED],
      [SettingsState.READY]: [
        SettingsState.LOADING,
        SettingsState.SAVING,
        SettingsState.IMPORTING,
        SettingsState.EXPORTING,
        SettingsState.BACKING_UP,
        SettingsState.RESTORING,
        SettingsState.FAILED
      ],
      [SettingsState.LOADING]: [SettingsState.READY, SettingsState.FAILED],
      [SettingsState.SAVING]: [SettingsState.READY, SettingsState.FAILED],
      [SettingsState.IMPORTING]: [SettingsState.READY, SettingsState.FAILED],
      [SettingsState.EXPORTING]: [SettingsState.READY, SettingsState.FAILED],
      [SettingsState.BACKING_UP]: [SettingsState.READY, SettingsState.FAILED],
      [SettingsState.RESTORING]: [SettingsState.READY, SettingsState.FAILED],
      [SettingsState.FAILED]: [SettingsState.INITIALIZING] // Allow retry
    };

    if (!validTransitions[current]?.includes(next)) {
      throw new SettingsValidationException(`Invalid settings state transition: ${current} -> ${next}`);
    }
  }
}
