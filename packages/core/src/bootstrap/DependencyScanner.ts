import { BootstrapManifest } from "./BootstrapManifest";
import { BootstrapModule } from "./BootstrapModule";
import { BootstrapValidationException } from "./types";

export class DependencyScanner {
  public static scan(manifest: BootstrapManifest): readonly string[] {
    const enabledModules = manifest.modules.filter((m) => m.enabled);
    const moduleMap = new Map<string, BootstrapModule>();

    for (const m of enabledModules) {
      moduleMap.set(m.id, m);
    }

    for (const m of enabledModules) {
      for (const depId of m.dependencies) {
        if (!moduleMap.has(depId)) {
          throw new BootstrapValidationException(
            `Module "${m.id}" depends on missing or disabled module "${depId}"`
          );
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
        throw new BootstrapValidationException(
          `Circular dependency detected in manifest modules: ${cycle.join(" -> ")}`
        );
      }
      if (!visited.has(u)) {
        temp.add(u);
        const neighbors = moduleMap.get(u)?.dependencies || [];
        for (const v of neighbors) {
          visit(v);
        }
        temp.delete(u);
        visited.add(u);
        order.push(u);
      }
    };

    for (const m of enabledModules) {
      if (!visited.has(m.id)) {
        visit(m.id);
      }
    }

    return order;
  }
}
