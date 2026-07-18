import { LearningState }              from "./LearningState";
import { LearningSource }             from "./LearningSource";
import { LearningType }               from "./LearningType";
import type {
  LearningRequest,
  LearningResponse,
  LearningSession,
  LearningPattern,
  SuccessPattern,
  FailurePattern,
  WorkflowPattern,
  PromptPattern,
  DecisionPattern,
  ProviderPattern,
  KnowledgeEntry,
  KnowledgeGraph,
  Recommendation,
  LearningInsight,
  ImprovementPlan,
  LearningReport,
  LearningSnapshot,
  LearningHistory,
} from "./models";

// ─── Learning Engine ─────────────────────────────────────────────────────────

export interface ILearningEngine {
  readonly state: LearningState;

  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  /** Execute a full learning cycle on collected historical records */
  learn(request: LearningRequest, history: LearningHistory[]): Promise<LearningResponse>;

  /** Retrieve the latest snapshot of the Knowledge Base & Patterns */
  getSnapshot(): LearningSnapshot;

  /** Get a detailed learning analysis report */
  getReport(): LearningReport;

  // Sub-learner exposures
  getPatternAnalyzer(): IPatternAnalyzer;
  getSuccessAnalyzer(): ISuccessAnalyzer;
  getFailureAnalyzer(): IFailureAnalyzer;
  getRecommendationEngine(): IRecommendationEngine;
  getKnowledgeManager(): IKnowledgeManager;
  getWorkflowLearner(): IWorkflowLearner;
  getPromptLearner(): IPromptLearner;
  getDecisionLearner(): IDecisionLearner;
  getProviderLearner(): IProviderLearner;
}

// ─── Pattern Analyzer ────────────────────────────────────────────────────────

export interface IPatternAnalyzer {
  analyze(history: LearningHistory[]): LearningPattern[];
}

// ─── Success Analyzer ────────────────────────────────────────────────────────

export interface ISuccessAnalyzer {
  analyzeSuccess(history: LearningHistory[]): SuccessPattern[];
}

// ─── Failure Analyzer ────────────────────────────────────────────────────────

export interface IFailureAnalyzer {
  analyzeFailure(history: LearningHistory[]): FailurePattern[];
}

// ─── Recommendation Engine ───────────────────────────────────────────────────

export interface IRecommendationEngine {
  generateRecommendations(patterns: LearningPattern[]): Recommendation[];
}

// ─── Knowledge Manager ────────────────────────────────────────────────────────

export interface IKnowledgeManager {
  updateKnowledge(entries: KnowledgeEntry[]): void;
  getGraph(): KnowledgeGraph;
  getEntry(id: string): KnowledgeEntry | undefined;
  listEntries(): KnowledgeEntry[];
}

// ─── Workflow Learner ────────────────────────────────────────────────────────

export interface IWorkflowLearner {
  learnWorkflow(history: LearningHistory[]): WorkflowPattern[];
}

// ─── Prompt Learner ──────────────────────────────────────────────────────────

export interface IPromptLearner {
  learnPrompt(history: LearningHistory[]): PromptPattern[];
}

// ─── Decision Learner ────────────────────────────────────────────────────────

export interface IDecisionLearner {
  learnDecision(history: LearningHistory[]): DecisionPattern[];
}

// ─── Provider Learner ────────────────────────────────────────────────────────

export interface IProviderLearner {
  learnProvider(history: LearningHistory[]): ProviderPattern[];
}
