import { ImprovementState } from "./ImprovementState";
import { OptimizationTarget } from "./OptimizationTarget";
import {
  PerformancePattern,
  ImprovementRecommendation,
  LearningSample,
  OptimizationDecision,
  ABTest,
  Experiment,
  ImprovementHistory,
  ImprovementSnapshot,
  ImprovementStatistics,
  LearningDataset,
  FeedbackLoop
} from "./models";

export interface IAutonomousImprovementEngine {
  getState(): ImprovementState;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  runImprovementCycle(datasetId: string): Promise<OptimizationDecision[]>;
  getSnapshot(): ImprovementSnapshot;
  getStatistics(): ImprovementStatistics;

  // Managers
  getLearningManager(): ILearningManager;
  getPatternManager(): IPatternManager;
  getRecommendationManager(): IRecommendationManager;
  getOptimizationManager(): IOptimizationManager;
  getExperimentManager(): IExperimentManager;
  getABTestingManager(): IABTestingManager;
  getFeedbackManager(): IFeedbackManager;
  getDecisionManager(): IDecisionManager;
  getHistoryManager(): IHistoryManager;
  getStatisticsManager(): IStatisticsManager;

  // Events
  on(event: string, handler: (payload: any) => void): void;
  off(event: string, handler: (payload: any) => void): void;
}

export interface ILearningManager {
  loadDataset(datasetId: string): Promise<LearningDataset>;
  parseSamples(dataset: LearningDataset): Promise<LearningSample[]>;
}

export interface IPatternManager {
  detectPatterns(samples: LearningSample[]): Promise<PerformancePattern[]>;
  getWinningTopics(): Promise<string[]>;
  getAudiencePatterns(): Promise<string[]>;
}

export interface IRecommendationManager {
  generateRecommendations(patterns: PerformancePattern[]): Promise<ImprovementRecommendation[]>;
  prioritizeRecommendations(recs: ImprovementRecommendation[]): Promise<ImprovementRecommendation[]>;
}

export interface IOptimizationManager {
  createOptimization(rec: ImprovementRecommendation): Promise<OptimizationDecision>;
  calculateOptimizationScore(decision: OptimizationDecision): Promise<number>;
}

export interface IExperimentManager {
  startExperiment(name: string, target: OptimizationTarget): Promise<Experiment>;
  createVariants(experimentId: string, count: number): Promise<string[]>;
}

export interface IABTestingManager {
  runABTest(test: ABTest): Promise<ABTest>;
  calculateConfidence(test: ABTest): Promise<number>;
}

export interface IFeedbackManager {
  connectFeedback(loop: FeedbackLoop): Promise<void>;
  returnToPipeline(decision: OptimizationDecision): Promise<boolean>;
}

export interface IDecisionManager {
  approveRecommendation(rec: ImprovementRecommendation): Promise<boolean>;
  rejectRecommendation(rec: ImprovementRecommendation): Promise<boolean>;
}

export interface IHistoryManager {
  logImprovement(history: ImprovementHistory): Promise<void>;
  getHistory(target: OptimizationTarget): Promise<ImprovementHistory[]>;
}

export interface IStatisticsManager {
  getStats(): ImprovementStatistics;
  updateStats(delta: Partial<ImprovementStatistics>): void;
}
