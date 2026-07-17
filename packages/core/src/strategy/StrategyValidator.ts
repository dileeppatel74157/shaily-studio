import { StrategyValidationException } from "./types";
import { StrategyRequest, StrategyResponse, CalendarEntry } from "./models";

export class StrategyValidator {
  public static validateRequest(request: StrategyRequest): void {
    if (!request.id) {
      throw new StrategyValidationException("Request ID is required.");
    }
    if (!request.type) {
      throw new StrategyValidationException("Strategy Type is required.");
    }
    if (!request.researchResponse || !request.researchResponse.topics || request.researchResponse.topics.length === 0) {
      throw new StrategyValidationException("Research response cannot be empty.");
    }
  }

  public static validateResponse(response: StrategyResponse): void {
    if (!response.strategyId) {
      throw new StrategyValidationException("Response strategyId is required.");
    }
    if (!response.pillars || response.pillars.length === 0) {
      throw new StrategyValidationException("Pillars list cannot be empty (Empty strategies check).");
    }
    if (!response.calendar || !response.calendar.entries || response.calendar.entries.length === 0) {
      throw new StrategyValidationException("Calendar entries cannot be empty (Empty strategies check).");
    }

    const entries = response.calendar.entries;

    // 1. Duplicate topics check
    const topics = new Set<string>();
    for (const entry of entries) {
      if (topics.has(entry.topic.toLowerCase())) {
        throw new StrategyValidationException(`Duplicate topic detected in calendar: ${entry.topic}`);
      }
      topics.add(entry.topic.toLowerCase());
    }

    // 2. Schedule conflict check (same publish date)
    const dates = new Set<string>();
    for (const entry of entries) {
      const dateStr = entry.publishDate.toISOString();
      if (dates.has(dateStr)) {
        throw new StrategyValidationException(`Schedule conflict: Multiple entries scheduled at ${dateStr}`);
      }
      dates.add(dateStr);
    }

    // 3. Dependency existence & Circular Planning check
    this.validateDependencies(entries);
  }

  public static validateDependencies(entries: CalendarEntry[]): void {
    const entryMap = new Map<string, CalendarEntry>();
    for (const entry of entries) {
      entryMap.set(entry.id, entry);
    }

    // Existence check
    for (const entry of entries) {
      for (const depId of entry.dependencies) {
        if (!entryMap.has(depId)) {
          throw new StrategyValidationException(`Invalid dependency: Entry "${entry.id}" depends on non-existent entry "${depId}"`);
        }
      }
    }

    // Cycle detection (Circular planning)
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const checkCycle = (id: string) => {
      if (recStack.has(id)) {
        throw new StrategyValidationException(`Circular planning dependency detected: loop contains "${id}"`);
      }
      if (!visited.has(id)) {
        visited.add(id);
        recStack.add(id);
        const entry = entryMap.get(id);
        if (entry) {
          for (const depId of entry.dependencies) {
            checkCycle(depId);
          }
        }
        recStack.delete(id);
      }
    };

    for (const entry of entries) {
      checkCycle(entry.id);
    }
  }
}
