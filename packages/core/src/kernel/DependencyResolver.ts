import { KernelModule } from "./KernelModule";
import { CircularDependencyException, MissingDependencyException } from "./types";

export class DependencyResolver {
  public static resolve(modules: readonly KernelModule[]): {
    startupOrder: readonly string[];
    shutdownOrder: readonly string[];
  } {
    const adj = new Map<string, string[]>();
    const moduleMap = new Map<string, KernelModule>();

    for (const m of modules) {
      moduleMap.set(m.id, m);
      adj.set(m.id, [...m.dependencies]);
    }

    for (const m of modules) {
      for (const depId of m.dependencies) {
        if (!moduleMap.has(depId)) {
          throw new MissingDependencyException(m.id, depId);
        }
      }
    }

    const visited = new Set<string>();
    const temp = new Set<string>();
    const order: string[] = [];

    const visit = (u: string) => {
      if (temp.has(u)) {
        const cycle = Array.from(temp);
        cycle.push(u);
        throw new CircularDependencyException(cycle);
      }
      if (!visited.has(u)) {
        temp.add(u);
        const neighbors = adj.get(u) || [];
        for (const v of neighbors) {
          visit(v);
        }
        temp.delete(u);
        visited.add(u);
        order.push(u);
      }
    };

    for (const m of modules) {
      if (!visited.has(m.id)) {
        visit(m.id);
      }
    }

    const startupOrder = [...order];
    const shutdownOrder = [...order].reverse();

    return {
      startupOrder,
      shutdownOrder,
    };
  }
}
