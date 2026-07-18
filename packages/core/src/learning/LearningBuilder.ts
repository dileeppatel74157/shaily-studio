import { LearningEngine } from "./LearningEngine";
import { LearningValidationException } from "./types";
import type {
  IPatternAnalyzer,
  IKnowledgeManager,
  IRecommendationEngine,
  IWorkflowLearner,
  IPromptLearner,
  IDecisionLearner,
  IProviderLearner,
} from "./interfaces";

export class LearningBuilder {
  private _context?: any;
  private _metadata: Record<string, unknown> = {};

  private _patternAnalyzer?: IPatternAnalyzer;
  private _knowledgeManager?: IKnowledgeManager;
  private _recommendationEngine?: IRecommendationEngine;
  private _workflowLearner?: IWorkflowLearner;
  private _promptLearner?: IPromptLearner;
  private _decisionLearner?: IDecisionLearner;
  private _providerLearner?: IProviderLearner;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...metadata };
    return this;
  }

  public withPatternAnalyzer(analyzer: IPatternAnalyzer): this {
    this._patternAnalyzer = analyzer;
    return this;
  }

  public withKnowledgeManager(manager: IKnowledgeManager): this {
    this._knowledgeManager = manager;
    return this;
  }

  public withRecommendationEngine(engine: IRecommendationEngine): this {
    this._recommendationEngine = engine;
    return this;
  }

  public withWorkflowLearner(learner: IWorkflowLearner): this {
    this._workflowLearner = learner;
    return this;
  }

  public withPromptLearner(learner: IPromptLearner): this {
    this._promptLearner = learner;
    return this;
  }

  public withDecisionLearner(learner: IDecisionLearner): this {
    this._decisionLearner = learner;
    return this;
  }

  public withProviderLearner(learner: IProviderLearner): this {
    this._providerLearner = learner;
    return this;
  }

  public withMemory(memoryStore: any): this {
    if (!this._context) this._context = {};
    this._context.memoryStore = memoryStore;
    return this;
  }

  public withDecision(decisionEngine: any): this {
    if (!this._context) this._context = {};
    this._context.decisionEngine = decisionEngine;
    return this;
  }

  public withPlanner(planningEngine: any): this {
    if (!this._context) this._context = {};
    this._context.planningEngine = planningEngine;
    return this;
  }

  public build(): LearningEngine {
    if (!this._context) {
      throw new LearningValidationException("Context is required to build a LearningEngine.");
    }
    return new LearningEngine(
      this._context,
      this._patternAnalyzer,
      this._knowledgeManager,
      this._recommendationEngine,
      this._workflowLearner,
      this._promptLearner,
      this._decisionLearner,
      this._providerLearner,
      this._metadata
    );
  }
}
