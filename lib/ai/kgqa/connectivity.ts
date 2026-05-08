type Triple = {
  node1: string;
  node2: string;
  [key: string]: unknown;
};

class UnionFind {
  parent: Map<string, string>;
  rank: Map<string, number>;

  constructor() {
    this.parent = new Map();
    this.rank = new Map();
  }

  add(x: string) {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  find(x: string): string {
    const p = this.parent.get(x);
    if (p === undefined) {
      this.add(x);
      return x;
    }
    if (p !== x) {
      const root = this.find(p);
      this.parent.set(x, root);
      return root;
    }
    return x;
  }

  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) {
      return;
    }
    const rankA = this.rank.get(ra) ?? 0;
    const rankB = this.rank.get(rb) ?? 0;
    if (rankA < rankB) {
      this.parent.set(ra, rb);
    } else if (rankA > rankB) {
      this.parent.set(rb, ra);
    } else {
      this.parent.set(rb, ra);
      this.rank.set(ra, rankA + 1);
    }
  }

  connected(a: string, b: string): boolean {
    return this.find(a) === this.find(b);
  }

  components(): string[][] {
    const groups = new Map<string, string[]>();
    for (const node of this.parent.keys()) {
      const root = this.find(node);
      const group = groups.get(root);
      if (group) {
        group.push(node);
      } else {
        groups.set(root, [node]);
      }
    }
    return Array.from(groups.values());
  }
}

export function isPathConnected(clauses: Triple[]): boolean {
  if (clauses.length <= 1) {
    return true;
  }
  const uf = new UnionFind();
  for (const c of clauses) {
    uf.add(c.node1);
    uf.add(c.node2);
    uf.union(c.node1, c.node2);
  }
  return uf.components().length === 1;
}

export function findConnectedComponents(triples: Triple[]): string[][] {
  const uf = new UnionFind();
  for (const t of triples) {
    uf.add(t.node1);
    uf.add(t.node2);
    uf.union(t.node1, t.node2);
  }
  return uf.components();
}

export function isGraphConnected(triples: Triple[]): boolean {
  return findConnectedComponents(triples).length === 1;
}

export function buildBridgePrompt(components: string[][]): string {
  const lines: string[] = [];
  lines.push(
    `The knowledge graph has ${components.length} disconnected components. Generate exactly ${components.length - 1} bridging triple(s) to connect them all.\n`
  );
  for (let i = 0; i < components.length; i++) {
    const sample = components[i].slice(0, 5).join(", ");
    lines.push(
      `Group ${i + 1}: ${sample}${components[i].length > 5 ? ` (and ${components[i].length - 5} more)` : ""}`
    );
  }
  lines.push(
    "\nFor each consecutive pair (Group 1↔2, Group 2↔3, etc.), generate one triple where node1 is from one group and node2 is from the other."
  );
  return lines.join("\n");
}
