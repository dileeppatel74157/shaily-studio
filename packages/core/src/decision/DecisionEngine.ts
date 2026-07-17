import { IDecisionEngine } from "./IDecisionEngine";
import { Decision } from "./Decision";
import { DecisionOption } from "./DecisionOption";
import { DecisionOutcome } from "./DecisionOutcome";
import { DecisionHistory } from "./DecisionHistory";
import { DecisionSnapshot } from "./DecisionSnapshot";
import { DecisionState } from "./DecisionState";
import { DecisionRisk } from "./DecisionRisk";
import { DecisionCriteria } from "./DecisionCriteria";
import { DecisionExplanation } from "./DecisionExplanation";
import { DecisionConfidence } from "./DecisionConfidence";
import { DecisionType } from "./DecisionType";
import { DecisionValidator } from "./DecisionValidator";
import { deepFreeze } from "./types";

export class DecisionEngine implements IDecisionEngine {
  private _state = DecisionState.CREATED;
  private readonly _decisions = new Map<string, Decision>();
  private readonly _history: DecisionHistory[] = [];

  constructor(public readonly context: any) {}

  public async evaluate(decision: Decision): Promise<Decision> {
    this._state = DecisionState.EVALUATING;

    // Validate
    DecisionValidator.validate(decision);

    const mutableDecision = { ...decision, state: DecisionState.EVALUATING };

    // 1. Constraint Validation
    let eligibleOptions = decision.options.filter((opt) => {
      for (const constr of decision.constraints) {
        if (!constr.validate(opt)) {
          return false;
        }
      }
      return true;
    });

    // 2. Policy Enforcement
    for (const policy of decision.policies) {
      eligibleOptions = policy.evaluate(eligibleOptions, decision.context) as DecisionOption[];
    }

    if (eligibleOptions.length === 0) {
      // Fallback
      if (decision.fallbackOptionId) {
        const fallback = decision.options.find((o) => o.id === decision.fallbackOptionId);
        if (fallback) {
          eligibleOptions = [fallback];
        }
      }

      if (eligibleOptions.length === 0) {
        mutableDecision.state = DecisionState.REJECTED;
        if (decision.context.eventBus) {
          await decision.context.eventBus.publish({
            id: "evt-" + Math.random().toString(36).substring(2, 11),
            name: "DecisionFailed",
            timestamp: new Date(),
            correlationId: "corr-decision",
            source: "DecisionEngine",
            payload: { decisionId: decision.id, reason: "No eligible options after constraints/policies" },
            metadata: {},
          });
        }
        throw new Error("No eligible options found for decision");
      }
    }

    // 3. Score Evaluation with Memory Feedback Loops
    const evaluatedOptions = await Promise.all(
      eligibleOptions.map(async (opt) => {
        let feasibility = opt.reward > 0 && opt.cost > 0 ? opt.reward / opt.cost : 0.5;
        // Normalize feasibility to 0-1
        feasibility = Math.min(1.0, feasibility / 2);

        let alignment = 0.5;
        let efficiency = 0.5;

        // Extract metadata scores if present
        if (opt.metadata) {
          if (typeof opt.metadata.alignment === "number") alignment = opt.metadata.alignment;
          if (typeof opt.metadata.feasibility === "number") feasibility = opt.metadata.feasibility;
          if (typeof opt.metadata.efficiency === "number") efficiency = opt.metadata.efficiency;
        }

        // Memory feedback loop (self-optimization)
        if (decision.context.memoryStore) {
          const feedbackNamespace = "decision-feedback";
          const feedbackKey = `${opt.id}:success-rate`;
          const memRecord = await decision.context.memoryStore.get(feedbackNamespace, feedbackKey);
          if (memRecord && memRecord.value) {
            const successRate = (memRecord.value as any).rate || 0;
            // Boost alignment and feasibility based on historical success
            alignment = Math.min(1.0, alignment + successRate * 0.2);
            feasibility = Math.min(1.0, feasibility + successRate * 0.1);
          }
        }

        // Research Engine feedback loop
        if (decision.context.researchEngine) {
          try {
            const history = decision.context.researchEngine.getHistory();
            for (const resp of history) {
              const matchingTopic = resp.topics.find(
                (t: any) =>
                  t.topic.toLowerCase() === opt.id.toLowerCase() ||
                  t.topic.toLowerCase() === opt.name.toLowerCase()
              );
              if (matchingTopic) {
                // Boost alignment based on monetization and trend scores
                const boost = (matchingTopic.monetizationScore + matchingTopic.trendScore) * 0.1;
                alignment = Math.min(1.0, alignment + boost);
              }
            }
          } catch (e) {
            // Ignore if researchEngine fails
          }
        }

        // Strategy Engine feedback loop
        if (decision.context.strategyEngine) {
          try {
            const history = decision.context.strategyEngine.getHistory();
            for (const resp of history) {
              const matchingEntry = resp.calendar.entries.find(
                (entry: any) =>
                  entry.topic.toLowerCase() === opt.id.toLowerCase() ||
                  entry.topic.toLowerCase() === opt.name.toLowerCase()
              );
              if (matchingEntry) {
                // Boost alignment based on content priority
                let boost = 0.1;
                if (matchingEntry.priority === "CRITICAL") {
                  boost = 0.2;
                } else if (matchingEntry.priority === "LOW") {
                  boost = 0.05;
                }
                alignment = Math.min(1.0, alignment + boost);
              }
            }
          } catch (e) {
            // Ignore if strategyEngine fails
          }
        }

        // Channel Engine integration: penalize options violating brand rules or tone
        if (decision.context.channelEngine) {
          try {
            const history = decision.context.channelEngine.getHistory();
            if (history.length > 0) {
              const kb = history[history.length - 1];
              const hasNegativeKeyword = kb.brandGuide.consistencyRules.some(
                (rule: string) => opt.name.toLowerCase().includes("violate") || opt.name.toLowerCase().includes("invalid")
              );
              if (hasNegativeKeyword) {
                alignment = Math.max(0.0, alignment - 0.3); // Heavy penalty
              }
            }
          } catch (e) {
            // Ignore if channelEngine fails
          }
        }

        // Apply rules (boost / penalize)
        for (const policy of decision.policies) {
          for (const rule of policy.rules) {
            if (rule.condition(opt, decision.context)) {
              if (rule.action === "boost") {
                alignment = Math.min(1.0, alignment + (rule.value || 0.1));
              } else if (rule.action === "penalize") {
                alignment = Math.max(0.0, alignment - (rule.value || 0.1));
              }
            }
          }
        }

        // Risk rating to risk impact conversion
        let riskImpact = 0.2; // LOW
        if (opt.risk === DecisionRisk.MEDIUM) riskImpact = 0.5;
        else if (opt.risk === DecisionRisk.HIGH) riskImpact = 0.9;

        // Strategy adjustments
        if (decision.strategy === "COST_OPTIMIZATION") {
          // Boost cheaper options
          const costFactor = opt.cost > 0 ? 1 / opt.cost : 1;
          feasibility = Math.min(1.0, feasibility + costFactor * 0.2);
        } else if (decision.strategy === "RISK_MINIMIZATION") {
          // Penalize high risk options heavily
          riskImpact = Math.min(1.0, riskImpact * 1.5);
        }

        // Weighted Scoring calculation
        let overall = 0;
        let totalWeight = 0;
        for (const crit of decision.criteria) {
          totalWeight += crit.weight;
          if (crit.name === "alignment") overall += alignment * crit.weight;
          else if (crit.name === "feasibility") overall += feasibility * crit.weight;
          else if (crit.name === "efficiency") overall += efficiency * crit.weight;
          else if (crit.name === "riskImpact") overall += (1.0 - riskImpact) * crit.weight;
          else overall += 0.5 * crit.weight;
        }

        overall = totalWeight > 0 ? overall / totalWeight : 0;

        return {
          ...opt,
          scores: {
            alignment,
            feasibility,
            efficiency,
            riskImpact,
            overall,
          },
        };
      })
    );

    // Sort by overall score descending
    evaluatedOptions.sort((a, b) => (b.scores?.overall || 0) - (a.scores?.overall || 0));

    const selectedOption = evaluatedOptions[0];

    // 4. Confidence Calculation
    const topScore = selectedOption.scores?.overall || 0;
    const secondScore = evaluatedOptions[1] ? evaluatedOptions[1].scores?.overall || 0 : 0;
    const margin = topScore - secondScore;
    const riskVal = selectedOption.scores?.riskImpact || 0.2;
    const confidenceScore = Math.min(1.0, Math.max(0.0, 0.4 + margin * 0.5 + (1.0 - riskVal) * 0.2));

    const confidence: DecisionConfidence = {
      score: confidenceScore,
      dataDensity: decision.options.length > 0 ? 1.0 : 0.0,
      riskBuffer: 1.0 - riskVal,
      explanation: `Confidence is ${Math.round(confidenceScore * 100)}% based on score margin ${Math.round(margin * 100)}% and risk buffering.`,
    };

    // 5. Explanation Generation
    const explanation: DecisionExplanation = {
      decisionId: decision.id,
      selectedOptionId: selectedOption.id,
      rationale: `Option "${selectedOption.name}" chosen with overall score ${Math.round(topScore * 100)}%.`,
      scoreBreakdown: {
        alignment: selectedOption.scores?.alignment || 0,
        feasibility: selectedOption.scores?.feasibility || 0,
        efficiency: selectedOption.scores?.efficiency || 0,
        overall: topScore,
      },
      riskAnalysis: `Risk level is ${selectedOption.risk} (impact value ${selectedOption.scores?.riskImpact}).`,
      reasons: [
        { code: "SCORE_OPTIMAL", description: "Highest aggregated weighted score", scoreImpact: margin },
      ],
    };

    const finalDecision: Decision = deepFreeze({
      ...mutableDecision,
      state: DecisionState.COMMITTED,
      options: evaluatedOptions,
      selectedOptionId: selectedOption.id,
      confidence,
      explanation,
      timestamp: new Date(),
    });

    this._decisions.set(finalDecision.id, finalDecision);
    this._state = DecisionState.COMMITTED;

    // Log history
    const historyEntry: DecisionHistory = {
      decisionId: finalDecision.id,
      timestamp: new Date(),
      type: finalDecision.type,
      optionsCount: finalDecision.options.length,
      selectedOptionId: selectedOption.id,
      confidence: confidenceScore,
    };
    this._history.push(historyEntry);

    // Save to memory store if present
    if (decision.context.memoryStore) {
      await decision.context.memoryStore.set("decision_history", finalDecision.id, historyEntry);
    }

    // Publish event
    if (decision.context.eventBus) {
      await decision.context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "DecisionMade",
        timestamp: new Date(),
        correlationId: "corr-decision",
        source: "DecisionEngine",
        payload: { decisionId: finalDecision.id, selectedOptionId: selectedOption.id, confidence: confidenceScore },
        metadata: {},
      });
    }

    return finalDecision;
  }

  public async recordOutcome(outcome: DecisionOutcome): Promise<void> {
    // Record feedback in memory for self-optimization
    if (this.context.memoryStore) {
      const feedbackNamespace = "decision-feedback";
      const feedbackKey = `${outcome.selectedOptionId}:success-rate`;
      const memRecord = await this.context.memoryStore.get(feedbackNamespace, feedbackKey);
      let count = 0;
      let successes = 0;
      if (memRecord && memRecord.value) {
        count = (memRecord.value as any).count || 0;
        successes = (memRecord.value as any).successes || 0;
      }
      count++;
      if (outcome.success) {
        successes++;
      }
      await this.context.memoryStore.set(feedbackNamespace, feedbackKey, {
        count,
        successes,
        rate: successes / count,
      });
    }

    // Event publish outcome
    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "DecisionOutcomeRecorded",
        timestamp: new Date(),
        correlationId: "corr-decision",
        source: "DecisionEngine",
        payload: outcome,
        metadata: {},
      });
    }
  }

  public async getHistory(type?: DecisionType): Promise<ReadonlyArray<DecisionHistory>> {
    let result = [...this._history];
    if (this.context.memoryStore) {
      const keys = await this.context.memoryStore.keys("decision_history");
      const list: DecisionHistory[] = [];
      for (const k of keys) {
        const parts = k.split(":");
        const key = parts[parts.length - 1];
        const entry = await this.context.memoryStore.get("decision_history", key);
        if (entry && entry.value) {
          list.push(entry.value as DecisionHistory);
        }
      }
      result = list;
    }
    if (type) {
      return result.filter((h) => h.type === type);
    }
    return result;
  }

  public snapshot(): ReadonlyArray<DecisionSnapshot> {
    const list = Array.from(this._decisions.values()).map((d) => ({
      id: d.id,
      type: d.type,
      state: d.state,
      options: d.options,
      selectedOptionId: d.selectedOptionId,
      confidence: d.confidence?.score,
      timestamp: d.timestamp,
    }));

    return deepFreeze(list);
  }
}
