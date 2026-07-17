import { IStrategyEngine } from "./interfaces";
import { StrategyState } from "./StrategyState";
import { StrategyType } from "./StrategyType";
import { CalendarStatus } from "./CalendarStatus";
import { ContentPriority } from "./ContentPriority";
import { GrowthStage } from "./GrowthStage";
import {
  StrategyRequest,
  StrategyResponse,
  ContentPillar,
  ContentSeries,
  ContentCalendar,
  CalendarEntry,
  UploadSchedule,
  GrowthStrategy,
  StrategyPriority,
  StrategyReport,
  StrategySnapshot,
} from "./models";
import {
  IPillarBuilder,
  ISeriesPlanner,
  ISchedulePlanner,
  ICalendarGenerator,
} from "./interfaces";
import { StrategyValidator } from "./StrategyValidator";
import {
  StrategyException,
  StrategyValidationException,
  InvalidStrategyStateException,
  DuplicateStrategyException,
  deepFreeze,
} from "./types";

export class StrategyEngine implements IStrategyEngine {
  private _state = StrategyState.CREATED;
  private readonly _requests = new Map<string, StrategyRequest>();
  private readonly _history: StrategyResponse[] = [];
  private readonly _snapshots = new Map<string, StrategySnapshot>();

  private readonly _pillarBuilder: IPillarBuilder;
  private readonly _seriesPlanner: ISeriesPlanner;
  private readonly _schedulePlanner: ISchedulePlanner;
  private readonly _calendarGenerator: ICalendarGenerator;

  constructor(
    public readonly context: any,
    public readonly configuration?: any,
    public readonly metadata: Record<string, unknown> = {},
    pillarBuilder?: IPillarBuilder,
    seriesPlanner?: ISeriesPlanner,
    schedulePlanner?: ISchedulePlanner,
    calendarGenerator?: ICalendarGenerator
  ) {
    this._pillarBuilder = pillarBuilder || {
      buildPillars: async (topics) => [
        {
          id: "pil-1",
          name: "TypeScript Architecture",
          description: "Advanced architecture and design patterns in TypeScript.",
          supportingTopics: topics.slice(0, 2),
          relationshipIds: ["pil-2"],
        },
        {
          id: "pil-2",
          name: "High Performance Web Graphics",
          description: "Utilizing WebGPU, WebGL, and canvas for graphics.",
          supportingTopics: topics.slice(1, 3),
          relationshipIds: ["pil-1"],
        },
      ],
    };

    this._seriesPlanner = seriesPlanner || {
      planSeries: async (pillars) => [
        {
          id: "ser-1",
          name: "Advanced TypeScript Demystified",
          topics: pillars[0].supportingTopics,
          episodes: ["Generics Deep Dive", "Utility Types & Custom Helpers", "Webpack to Vite Build System Migration"],
          continuationOpportunity: "Extend to Type-level programming and AST generators.",
        },
      ],
    };

    this._schedulePlanner = schedulePlanner || {
      planSchedule: async (type) => ({
        frequency: "WEEKLY",
        bestPublishTimes: ["Thursday 3PM EST", "Sunday 10AM EST"],
      }),
    };

    this._calendarGenerator = calendarGenerator || {
      generateCalendar: async (pillars, series, schedule) => {
        const baseDate = new Date("2026-07-20T15:00:00.000Z");
        const entry1: CalendarEntry = {
          id: "cal-1",
          topic: pillars[0].supportingTopics[0] || "WebGPU TypeScript Development",
          publishDate: baseDate,
          priority: ContentPriority.CRITICAL,
          dependencies: [],
          status: CalendarStatus.SCHEDULED,
        };

        const entry2: CalendarEntry = {
          id: "cal-2",
          topic: pillars[0].supportingTopics[1] || "Advanced Generics in TS",
          publishDate: new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days later
          priority: ContentPriority.HIGH,
          dependencies: ["cal-1"],
          status: CalendarStatus.SCHEDULED,
        };

        return { entries: [entry1, entry2] };
      },
    };
  }

  public get state(): StrategyState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state !== StrategyState.CREATED) {
      throw new InvalidStrategyStateException("engine", "initialize", this._state);
    }
    this._state = StrategyState.INITIALIZED;
    if (this.context.logger) {
      this.context.logger.info("StrategyEngine initialized.");
    }
  }

  public async start(): Promise<void> {
    if (this._state !== StrategyState.INITIALIZED && this._state !== StrategyState.STOPPED) {
      throw new InvalidStrategyStateException("engine", "start", this._state);
    }
    this._state = StrategyState.RUNNING;
    if (this.context.logger) {
      this.context.logger.info("StrategyEngine started.");
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== StrategyState.RUNNING) {
      throw new InvalidStrategyStateException("engine", "stop", this._state);
    }
    this._state = StrategyState.STOPPED;
    if (this.context.logger) {
      this.context.logger.info("StrategyEngine stopped.");
    }
  }

  public getSnapshot(strategyId: string): StrategySnapshot {
    const snapshot = this._snapshots.get(strategyId);
    if (!snapshot) {
      throw new StrategyException(`No snapshot found for strategy "${strategyId}"`);
    }
    return snapshot;
  }

  public getHistory(): StrategyResponse[] {
    return [...this._history];
  }

  public async generate(request: StrategyRequest): Promise<StrategyResponse> {
    if (this._state !== StrategyState.RUNNING) {
      throw new InvalidStrategyStateException(request.id, "generate", this._state);
    }

    // 1. Validate request
    StrategyValidator.validateRequest(request);

    // Duplicate request ID check
    if (this._requests.has(request.id)) {
      throw new DuplicateStrategyException(request.id);
    }
    this._requests.set(request.id, request);

    // 2. Duplicate prevention check
    const queryKey = request.researchResponse.requestId;
    const isDuplicate = this._history.some(
      (h) => h.strategyId === request.id || h.reports.some((r) => r.id.includes(queryKey))
    );
    if (isDuplicate) {
      throw new StrategyException(`Duplicate strategy generation requested for query/ID: ${queryKey}`);
    }

    // Check Memory Store
    if (this.context.memoryStore) {
      const existing = await this.context.memoryStore.get("strategy-memory", `strategy:${queryKey}`);
      if (existing) {
        if (request.options?.allowCached) {
          if (this.context.logger) {
            this.context.logger.info(`Returning cached strategy response for: ${queryKey}`);
          }
          return existing.value as StrategyResponse;
        } else {
          throw new StrategyException(`Duplicate strategy request detected in Memory Store for: ${queryKey}`);
        }
      }
    }

    // Publish event StrategyStarted
    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-strategy-start-" + Math.random().toString(36).substring(2, 11),
        name: "StrategyStarted",
        timestamp: new Date(),
        correlationId: request.correlationId || "corr-strategy-" + request.id,
        source: "StrategyEngine",
        payload: { strategyId: request.id, type: request.type },
        metadata: {},
      });
    }

    try {
      const topics = request.researchResponse.topics.map((t) => t.topic);

      // State execution
      this._state = StrategyState.PILLAR_BUILDING;
      const pillars = await this._pillarBuilder.buildPillars(topics);

      this._state = StrategyState.SERIES_PLANNING;
      const series = await this._seriesPlanner.planSeries(pillars);

      this._state = StrategyState.SCHEDULE_GENERATION;
      const schedule = await this._schedulePlanner.planSchedule(request.type);

      this._state = StrategyState.CALENDAR_GENERATION;
      const calendar = await this._calendarGenerator.generateCalendar(pillars, series, schedule);

      // Content Prioritization
      this._state = StrategyState.PRIORITIZATION;
      const priorities: StrategyPriority[] = request.researchResponse.topics.map((t, idx) => {
        // Sort/prioritization formula combining opportunity, trend, monetization, and confidence
        const score = (t.finalScore + t.trendScore + t.monetizationScore + t.confidenceScore) / 4;
        return {
          topic: t.topic,
          score: Number(score.toFixed(4)),
          rank: idx + 1,
        };
      });

      // Growth Strategy Engine
      this._state = StrategyState.GROWTH_PLANNING;
      const growth: GrowthStrategy = {
        stage: GrowthStage.LAUNCH,
        shortTermRoadmap: ["Release 3 videos on: " + topics[0]],
        mediumTermRoadmap: ["Expand content to cover: " + (topics[1] || "Supporting topic")],
        longTermRoadmap: ["Build a masterclass course around: " + topics[0]],
      };

      // Strategy Optimizer (Uses memory previous performance / feedback loops)
      this._state = StrategyState.OPTIMIZATION;
      if (this.context.memoryStore) {
        const winningPillars = await this.context.memoryStore.get("strategy-memory", "winning-pillars");
        if (winningPillars && winningPillars.value) {
          const list = winningPillars.value as string[];
          // Boost matching pillars or adapt roadmap
          if (list.includes(pillars[0]?.name)) {
            growth.shortTermRoadmap.push("Optimize series based on historically winning pillar: " + pillars[0]?.name);
          }
        }
      }

      const report: StrategyReport = {
        id: "rep-str-" + request.id + "-" + Math.random().toString(36).substring(2, 7),
        timestamp: new Date(),
        roadmap: [...growth.shortTermRoadmap, ...growth.mediumTermRoadmap],
        calendarSummary: `Scheduled ${calendar.entries.length} episodes on calendar.`,
        uploadSchedule: `Upload frequency: ${schedule.frequency} at ${schedule.bestPublishTimes.join(", ")}`,
        priorities: priorities,
        recommendedExecutionOrder: priorities.map((p) => p.topic),
      };

      const response: StrategyResponse = {
        strategyId: request.id,
        state: StrategyState.COMPLETED,
        pillars,
        series,
        schedule,
        calendar,
        growth,
        priorities,
        reports: [report],
        timestamp: new Date(),
      };

      // Validator Rules
      StrategyValidator.validateResponse(response);

      // Store snapshot & deepFreeze it
      const snapshot: StrategySnapshot = {
        strategyId: request.id,
        state: StrategyState.COMPLETED,
        pillars: response.pillars,
        calendar: response.calendar.entries,
        timestamp: response.timestamp,
      };
      deepFreeze(snapshot);
      this._snapshots.set(request.id, snapshot);

      // Store in History
      this._history.push(response);

      // Store in MemoryEngine / MemoryStore
      if (this.context.memoryStore) {
        await this.context.memoryStore.set(
          "strategy-memory",
          `strategy:${queryKey}`,
          response,
          { strategyId: request.id, calendarCount: calendar.entries.length }
        );
      }

      // Publish event StrategyCompleted
      if (this.context.eventBus) {
        await this.context.eventBus.publish({
          id: "evt-strategy-complete-" + Math.random().toString(36).substring(2, 11),
          name: "StrategyCompleted",
          timestamp: new Date(),
          correlationId: request.correlationId || "corr-strategy-" + request.id,
          source: "StrategyEngine",
          payload: { strategyId: request.id, calendarCount: calendar.entries.length },
          metadata: {},
        });
      }

      this._state = StrategyState.RUNNING; // restore to RUNNING state when done
      return response;
    } catch (error: any) {
      this._state = StrategyState.FAILED;
      
      // Publish event StrategyFailed
      if (this.context.eventBus) {
        await this.context.eventBus.publish({
          id: "evt-strategy-fail-" + Math.random().toString(36).substring(2, 11),
          name: "StrategyFailed",
          timestamp: new Date(),
          correlationId: request.correlationId || "corr-strategy-" + request.id,
          source: "StrategyEngine",
          payload: { strategyId: request.id, error: error.message },
          metadata: {},
        });
      }
      throw error;
    }
  }
}
