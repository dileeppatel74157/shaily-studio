import { FounderAIState } from "./FounderAIState";
import { FounderMode } from "./FounderMode";
import { FounderGoalType } from "./FounderGoalType";
import { DecisionPriority } from "./DecisionPriority";
import {
  FounderProfile,
  FounderGoal,
  FounderDecision,
  FounderTask,
  FounderSession,
  FounderDailyBrief,
  FounderInsight,
  FounderRecommendation,
  FounderExecutionPlan,
  FounderSnapshot,
  FounderStatistics
} from "./models";

export interface IFounderAIEngine {
  getState(): FounderAIState;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  getSnapshot(): FounderSnapshot;
  getStatistics(): FounderStatistics;
  
  getFounderManager(): IFounderManager;
  getGoalManager(): IGoalManager;
  getDecisionManager(): IDecisionManager;
  getPlanningManager(): IPlanningManager;
  getExecutionManager(): IExecutionManager;
  getRecommendationManager(): IRecommendationManager;
  getInsightManager(): IInsightManager;
  getRoutineManager(): IRoutineManager;
  getHistoryManager(): IHistoryManager;
  getStatisticsManager(): IStatisticsManager;
  
  on(event: string, handler: (payload: any) => void): void;
  off(event: string, handler: (payload: any) => void): void;
}

export interface IFounderManager {
  getProfile(): FounderProfile;
  updateProfile(profile: Partial<FounderProfile>): void;
}

export interface IGoalManager {
  createGoal(goal: FounderGoal): void;
  updateGoal(id: string, updates: Partial<FounderGoal>): void;
  archiveGoal(id: string): void;
  listGoals(): FounderGoal[];
}

export interface IDecisionManager {
  evaluateDecision(decision: FounderDecision): FounderDecision;
  getDecision(id: string): FounderDecision | undefined;
  listDecisions(): FounderDecision[];
}

export interface IPlanningManager {
  generateDailyPlan(): Promise<FounderDailyBrief>;
  generateWeeklyPlan(): Promise<string[]>;
}

export interface IExecutionManager {
  executeCommand(command: string): Promise<any>;
}

export interface IRecommendationManager {
  generateRecommendations(): FounderRecommendation[];
  listRecommendations(): FounderRecommendation[];
}

export interface IInsightManager {
  generateInsights(): FounderInsight;
  getInsights(): FounderInsight | undefined;
}

export interface IRoutineManager {
  startSession(mode: FounderMode): FounderSession;
  endSession(sessionId: string): void;
}

export interface IHistoryManager {
  saveSnapshot(snapshot: FounderSnapshot): void;
  getHistory(): FounderSnapshot[];
}

export interface IStatisticsManager {
  getStats(): FounderStatistics;
  recordTaskCompleted(): void;
  recordGoalCompleted(): void;
  recordHoursSaved(hours: number): void;
}
