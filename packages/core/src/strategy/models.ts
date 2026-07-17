import { StrategyState } from "./StrategyState";
import { StrategyType } from "./StrategyType";
import { CalendarStatus } from "./CalendarStatus";
import { ContentPriority } from "./ContentPriority";
import { GrowthStage } from "./GrowthStage";
import { ResearchResponse } from "../research/models";

export interface StrategyRequest {
  id: string;
  type: StrategyType;
  researchResponse: ResearchResponse;
  state: StrategyState;
  timestamp: Date;
  correlationId?: string;
  options?: Record<string, any>;
}

export interface StrategyResponse {
  strategyId: string;
  state: StrategyState;
  pillars: ContentPillar[];
  series: ContentSeries[];
  schedule: UploadSchedule;
  calendar: ContentCalendar;
  growth: GrowthStrategy;
  priorities: StrategyPriority[];
  reports: StrategyReport[];
  timestamp: Date;
}

export interface ContentPillar {
  id: string;
  name: string;
  description: string;
  supportingTopics: string[];
  relationshipIds: string[];
}

export interface ContentSeries {
  id: string;
  name: string;
  topics: string[];
  episodes: string[];
  continuationOpportunity: string;
}

export interface CalendarEntry {
  id: string;
  topic: string;
  publishDate: Date;
  priority: ContentPriority;
  dependencies: string[];
  status: CalendarStatus;
}

export interface ContentCalendar {
  entries: CalendarEntry[];
}

export interface UploadSchedule {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  bestPublishTimes: string[];
}

export interface GrowthStrategy {
  stage: GrowthStage;
  shortTermRoadmap: string[];
  mediumTermRoadmap: string[];
  longTermRoadmap: string[];
}

export interface StrategyPriority {
  topic: string;
  score: number;
  rank: number;
}

export interface StrategyReport {
  id: string;
  timestamp: Date;
  roadmap: string[];
  calendarSummary: string;
  uploadSchedule: string;
  priorities: StrategyPriority[];
  recommendedExecutionOrder: string[];
}

export interface StrategySnapshot {
  strategyId: string;
  state: StrategyState;
  pillars: ReadonlyArray<ContentPillar>;
  calendar: ReadonlyArray<CalendarEntry>;
  timestamp: Date;
}
