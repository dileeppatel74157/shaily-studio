import { Decision } from "./Decision";
import { DecisionState } from "./DecisionState";
import { DecisionPriority } from "./DecisionPriority";
import { DecisionStrategy } from "./DecisionStrategy";
import { DecisionType } from "./DecisionType";
import { DecisionOption } from "./DecisionOption";
import { DecisionCriteria } from "./DecisionCriteria";
import { DecisionConstraint } from "./DecisionConstraint";
import { DecisionPolicy } from "./DecisionPolicy";
import { DecisionContext } from "./DecisionContext";

export class DecisionBuilder {
  private _id!: string;
  private _type: DecisionType = DecisionType.STRATEGY_SELECTION;
  private _priority: DecisionPriority = DecisionPriority.NORMAL;
  private _strategy: DecisionStrategy = DecisionStrategy.MULTI_ATTRIBUTIVE;
  private _options: DecisionOption[] = [];
  private _criteria: DecisionCriteria[] = [];
  private _constraints: DecisionConstraint[] = [];
  private _policies: DecisionPolicy[] = [];
  private _context!: DecisionContext;
  private _fallbackOptionId?: string;
  private _maxRetries?: number;

  public withId(id: string): this {
    this._id = id;
    return this;
  }

  public withType(type: DecisionType): this {
    this._type = type;
    return this;
  }

  public withPriority(priority: DecisionPriority): this {
    this._priority = priority;
    return this;
  }

  public withStrategy(strategy: DecisionStrategy): this {
    this._strategy = strategy;
    return this;
  }

  public withContext(context: DecisionContext): this {
    this._context = context;
    return this;
  }

  public addOption(option: DecisionOption): this {
    this._options.push(option);
    return this;
  }

  public addCriteria(criteria: DecisionCriteria): this {
    this._criteria.push(criteria);
    return this;
  }

  public addConstraint(constraint: DecisionConstraint): this {
    this._constraints.push(constraint);
    return this;
  }

  public addPolicy(policy: DecisionPolicy): this {
    this._policies.push(policy);
    return this;
  }

  public withFallbackOptionId(fallbackOptionId: string): this {
    this._fallbackOptionId = fallbackOptionId;
    return this;
  }

  public withMaxRetries(maxRetries: number): this {
    this._maxRetries = maxRetries;
    return this;
  }

  public build(): Decision {
    if (!this._id) throw new Error("Decision ID is required");
    if (!this._context) throw new Error("Context is required to build a Decision");

    return {
      id: this._id,
      type: this._type,
      priority: this._priority,
      strategy: this._strategy,
      state: DecisionState.CREATED,
      options: this._options,
      criteria: this._criteria,
      constraints: this._constraints,
      policies: this._policies,
      context: this._context,
      fallbackOptionId: this._fallbackOptionId,
      maxRetries: this._maxRetries,
      timestamp: new Date(),
    };
  }
}
