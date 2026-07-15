import { ServiceDescriptor } from "./ServiceDescriptor";
import { CompositionValidationException } from "./types";

export class CompositionValidator {
  public static validate(descriptors: Map<string, ServiceDescriptor>): void {
    // 1. Check for null/empty registrations
    for (const [token, desc] of descriptors) {
      if (!token || token.trim() === "") {
        throw new CompositionValidationException("Token cannot be empty.");
      }
      if (!desc.implementation && !desc.factory) {
        throw new CompositionValidationException(`Registration for "${token}" must have implementation or factory.`);
      }
    }

    // 2. Static Circular Dependency Check
    const visited = new Set<string>();
    const stack = new Set<string>();

    const checkCycle = (token: string) => {
      if (stack.has(token)) {
        const path = Array.from(stack).concat(token).join(" -> ");
        throw new CompositionValidationException(`Circular dependency detected in graph: ${path}`);
      }
      if (visited.has(token)) {
        return;
      }

      stack.add(token);
      
      const desc = descriptors.get(token);
      if (desc) {
        const inject = (desc.implementation as any)?.inject || [];
        for (const dep of inject) {
          checkCycle(dep);
        }
      }

      stack.delete(token);
      visited.add(token);
    };

    for (const token of descriptors.keys()) {
      checkCycle(token);
    }
  }

  public static validateIdentifier(id: string, name: string): void {
    if (!id || id.trim() === "") {
      throw new CompositionValidationException(`${name} identifier cannot be empty.`);
    }
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(id)) {
      throw new CompositionValidationException(
        `${name} identifier "${id}" must contain only alphanumeric characters, underscores, dashes, or dots.`
      );
    }
  }
}
