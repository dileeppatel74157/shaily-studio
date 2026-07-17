import {
  StrategyRequest,
  StrategyResponse,
  StrategySnapshot,
  ContentCalendar,
  UploadSchedule,
  ContentPillar,
  ContentSeries,
} from "./models";

export interface IStrategyEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  generate(request: StrategyRequest): Promise<StrategyResponse>;
  getSnapshot(strategyId: string): StrategySnapshot;
  getHistory(): StrategyResponse[];
}

export interface ICalendarGenerator {
  generateCalendar(pillars: ContentPillar[], series: ContentSeries[], schedule: UploadSchedule): Promise<ContentCalendar>;
}

export interface ISchedulePlanner {
  planSchedule(type: string): Promise<UploadSchedule>;
}

export interface IPillarBuilder {
  buildPillars(topics: string[]): Promise<ContentPillar[]>;
}

export interface ISeriesPlanner {
  planSeries(pillars: ContentPillar[]): Promise<ContentSeries[]>;
}
