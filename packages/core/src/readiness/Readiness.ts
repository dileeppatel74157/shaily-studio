import { IReadiness } from "./IReadiness";
import { ReadinessContext } from "./ReadinessContext";
import { ReadinessConfiguration } from "./ReadinessConfiguration";
import { ReadinessState } from "./ReadinessState";
import { ReadinessReport, ReadinessReportStatus } from "./ReadinessReport";
import { ReadinessResult, ReadinessStatus } from "./ReadinessResult";
import { ReadinessCheck } from "./ReadinessCheck";
import { ReadinessValidator } from "./ReadinessValidator";
import { ReadinessSnapshot } from "./ReadinessSnapshot";

import {
  InvalidReadinessStateException,
  deepFreeze,
} from "./types";

export class Readiness implements IReadiness {
  private _state: ReadinessState = ReadinessState.CREATED;
  private _latestReport: ReadinessReport | null = null;

  private _initializedAt: Date | null = null;
  private _startedAt: Date | null = null;
  private _stoppedAt: Date | null = null;

  private readonly _checks: ReadinessCheck[] = [];

  constructor(
    public readonly context: ReadinessContext,
    public readonly configuration: ReadinessConfiguration,
    public readonly metadata: Readonly<Record<string, unknown>>
  ) {
    this.registerBuiltInChecks();
  }

  public async initialize(): Promise<void> {
    if (this._state !== ReadinessState.CREATED) {
      throw new InvalidReadinessStateException("initialize", this._state);
    }
    this._state = ReadinessState.INITIALIZING;
    this._initializedAt = new Date();
    this._state = ReadinessState.READY;
  }

  public async start(): Promise<void> {
    if (this._state !== ReadinessState.READY) {
      throw new InvalidReadinessStateException("start", this._state);
    }
    this._startedAt = new Date();
    this._state = ReadinessState.RUNNING;
  }

  public async stop(): Promise<void> {
    if (this._state !== ReadinessState.RUNNING) {
      throw new InvalidReadinessStateException("stop", this._state);
    }
    this._stoppedAt = new Date();
    this._state = ReadinessState.STOPPED;
  }

  public async runChecks(): Promise<ReadinessReport> {
    if (this._state !== ReadinessState.RUNNING) {
      throw new InvalidReadinessStateException("runChecks", this._state);
    }

    const startTimestamp = Date.now();
    const results: ReadinessResult[] = [];

    for (const check of this._checks) {
      const checkStart = Date.now();
      try {
        const result = await check.execute(this.context);
        results.push(result);
      } catch (err: any) {
        results.push({
          id: check.id,
          name: check.name,
          status: ReadinessStatus.FAIL,
          duration: Date.now() - checkStart,
          message: err.message || "Error running check",
          details: {},
        });
      }
    }

    let passed = 0;
    let warnings = 0;
    let failed = 0;
    let skipped = 0;

    for (const res of results) {
      if (res.status === ReadinessStatus.PASS) passed++;
      else if (res.status === ReadinessStatus.WARNING) warnings++;
      else if (res.status === ReadinessStatus.FAIL) failed++;
      else if (res.status === ReadinessStatus.SKIPPED) skipped++;
    }

    let overallStatus = ReadinessReportStatus.READY;
    if (failed > 0) {
      overallStatus = ReadinessReportStatus.NOT_READY;
    } else if (warnings > 0) {
      overallStatus = ReadinessReportStatus.DEGRADED;
    }

    const report: ReadinessReport = {
      overallStatus,
      totalChecks: results.length,
      passed,
      warnings,
      failed,
      skipped,
      duration: Date.now() - startTimestamp,
      checks: results,
      timestamp: new Date(),
    };

    ReadinessValidator.validateReport(report);
    this._latestReport = report;

    return deepFreeze(report);
  }

  public snapshot(): ReadinessSnapshot {
    const snap = {
      lifecycleState: this._state,
      latestReport: this._latestReport,
      metadata: this.metadata,
      timestamps: {
        initializedAt: this._initializedAt,
        startedAt: this._startedAt,
        stoppedAt: this._stoppedAt,
      },
    };
    return deepFreeze(snap);
  }

  private registerBuiltInChecks(): void {
    const addCheck = (id: string, name: string, propName: string) => {
      this._checks.push({
        id,
        name,
        execute: async (ctx) => {
          const startTime = Date.now();
          const studio = ctx.platform.studio;
          if (!studio) {
            return {
              id,
              name,
              status: ReadinessStatus.FAIL,
              duration: Date.now() - startTime,
              message: "Studio is not registered on Platform.",
              details: {},
            };
          }
          const val = (studio as any)[propName];
          if (!val) {
            return {
              id,
              name,
              status: ReadinessStatus.FAIL,
              duration: Date.now() - startTime,
              message: `Sub-framework "${name}" is not registered on Studio.`,
              details: {},
            };
          }
          return {
            id,
            name,
            status: ReadinessStatus.PASS,
            duration: Date.now() - startTime,
            message: `${name} is registered and valid.`,
            details: {},
          };
        },
      });
    };

    // Platform validation
    this._checks.push({
      id: "check.platform",
      name: "Platform validation",
      execute: async (ctx) => {
        const startTime = Date.now();
        if (!ctx.platform) {
          return {
            id: "check.platform",
            name: "Platform validation",
            status: ReadinessStatus.FAIL,
            duration: Date.now() - startTime,
            message: "Platform reference is missing.",
            details: {},
          };
        }
        return {
          id: "check.platform",
          name: "Platform validation",
          status: ReadinessStatus.PASS,
          duration: Date.now() - startTime,
          message: "Platform is registered and valid.",
          details: {},
        };
      },
    });

    // Studio validation
    this._checks.push({
      id: "check.studio",
      name: "Studio validation",
      execute: async (ctx) => {
        const startTime = Date.now();
        if (!ctx.platform.studio) {
          return {
            id: "check.studio",
            name: "Studio validation",
            status: ReadinessStatus.FAIL,
            duration: Date.now() - startTime,
            message: "Studio reference is missing on Platform.",
            details: {},
          };
        }
        return {
          id: "check.studio",
          name: "Studio validation",
          status: ReadinessStatus.PASS,
          duration: Date.now() - startTime,
          message: "Studio is registered and valid.",
          details: {},
        };
      },
    });

    addCheck("check.runtime", "Runtime validation", "runtime");
    addCheck("check.host", "Host validation", "host");
    addCheck("check.bootstrapper", "Bootstrap validation", "bootstrapper");
    addCheck("check.kernel", "Kernel validation", "kernel");
    addCheck("check.configuration", "Configuration validation", "configuration");
    addCheck("check.security", "Security validation", "security");
    addCheck("check.storage", "Storage validation", "storage");
    addCheck("check.scheduler", "Scheduler validation", "scheduler");
    addCheck("check.observability", "Observability validation", "observability");
    addCheck("check.gateway", "Gateway validation", "gateway");
    addCheck("check.mcp", "MCP validation", "mcp");
    addCheck("check.messagebus", "Message Bus validation", "messageBus");

    ReadinessValidator.validateChecks(this._checks);
  }
}
