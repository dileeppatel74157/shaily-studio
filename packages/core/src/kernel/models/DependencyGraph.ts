export interface DependencyNode {
  readonly id: string;
  readonly dependencies: readonly string[];
}

export class DependencyGraph {
  public readonly nodes: readonly DependencyNode[];

  constructor(nodes: readonly DependencyNode[]) {
    this.nodes = nodes;
  }
}
