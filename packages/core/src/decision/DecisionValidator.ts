import { Decision } from "./Decision";
import { DecisionPriority } from "./DecisionPriority";
import { DecisionRule } from "./DecisionRule";
import { DecisionValidationException } from "./types";

export class DecisionValidator {
  public static validate(decision: Decision): void {
    // 1. Invalid priorities
    const validPriorities = Object.values(DecisionPriority);
    if (!validPriorities.includes(decision.priority)) {
      throw new DecisionValidationException(`Invalid decision priority: ${decision.priority}`);
    }

    // 2. Empty options
    if (!decision.options || decision.options.length === 0) {
      throw new DecisionValidationException("Decision must have at least one option.");
    }

    // 3. Duplicate IDs in options
    const optionIds = new Set<string>();
    for (const opt of decision.options) {
      if (optionIds.has(opt.id)) {
        throw new DecisionValidationException(`Duplicate option ID: ${opt.id}`);
      }
      optionIds.add(opt.id);
    }

    // 4. Missing criteria
    if (!decision.criteria || decision.criteria.length === 0) {
      throw new DecisionValidationException("Decision criteria cannot be empty.");
    }

    // 5. Invalid weights
    let totalWeight = 0;
    for (const crit of decision.criteria) {
      if (crit.weight < 0 || crit.weight > 1) {
        throw new DecisionValidationException(`Criteria weight must be between 0 and 1, got ${crit.weight} for criteria ${crit.name}`);
      }
      totalWeight += crit.weight;
    }
    // Optional weight validation: total weight should be close to 1 or non-zero
    if (totalWeight <= 0) {
      throw new DecisionValidationException("Total criteria weight must be greater than 0");
    }

    // 6. Circular rules
    const allRules: DecisionRule[] = [];
    for (const policy of decision.policies) {
      if (!policy.id || !policy.name) {
        throw new DecisionValidationException("Policy is invalid: missing id or name");
      }
      allRules.push(...policy.rules);
    }
    this.validateCircularRules(allRules);

    // 7. Invalid constraints
    for (const constr of decision.constraints) {
      if (!constr.id || !constr.name || !constr.type || !constr.validate) {
        throw new DecisionValidationException(`Constraint ${constr.id} is invalid.`);
      }
    }
  }

  public static validateCircularRules(rules: ReadonlyArray<DecisionRule>): void {
    const adj = new Map<string, string>();
    for (const rule of rules) {
      if (rule.dependsOnRuleId) {
        adj.set(rule.id, rule.dependsOnRuleId);
      }
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const checkCycle = (node: string) => {
      if (recStack.has(node)) {
        throw new DecisionValidationException(`Circular rule dependency detected: path contains ${node}`);
      }
      if (!visited.has(node)) {
        visited.add(node);
        recStack.add(node);
        const dep = adj.get(node);
        if (dep) {
          checkCycle(dep);
        }
        recStack.delete(node);
      }
    };

    for (const rule of rules) {
      checkCycle(rule.id);
    }
  }

  public static validateConfidence(score: number): void {
    if (score < 0 || score > 1) {
      throw new DecisionValidationException(`Confidence score must be between 0 and 1, got ${score}`);
    }
  }
}
