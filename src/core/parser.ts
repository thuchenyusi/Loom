import type { DecisionDSL } from '../dsl/decision';
import type { GraphEdgeIR, GraphIR } from './types';
import { DiagramValidationError, validateDecisionDSL } from './validator';
import { decisionBranches } from './branches';

export function parseDecisionDSL(input: unknown): GraphIR {
  const result = validateDecisionDSL(input);
  if (!result.valid) throw new DiagramValidationError(result.errors);
  const spec = input as DecisionDSL;
  const edges: GraphEdgeIR[] = [];
  for (const [id, node] of Object.entries(spec.nodes)) {
    if (node.type === 'decision') {
      for (const branch of decisionBranches(node)) {
        // JSON tuples keep edge IDs distinct even for unusual user-supplied IDs.
        edges.push({ id: `edge:${JSON.stringify([id, branch.id])}`, source: id, target: branch.target, branch: branch.id, label: branch.label });
      }
    }
  }
  // G6 uses one namespace for node and edge IDs. Avoid any collision with a DSL node ID.
  const ids = new Set([...Object.keys(spec.nodes), ...Object.keys(spec.groups ?? {})]);
  for (const edge of edges) {
    while (ids.has(edge.id)) edge.id = `edge:${edge.id}`;
    ids.add(edge.id);
  }
  return {
    id: spec.id, kind: 'graph', start: spec.start,
    nodes: Object.entries(spec.nodes).map(([id, node]) => ({ id, kind: node.type, label: node.label, ...(node.group ? { group: node.group } : {}), ...(node.metadata ? { metadata: structuredClone(node.metadata) } : {}) })),
    edges,
    groups: Object.entries(spec.groups ?? {}).map(([id, group]) => ({ id, label: group.label, collapsed: group.collapsed ?? false, ...(group.parent ? { parent: group.parent } : {}) })),
    samples: Object.entries(spec.samples ?? {}).map(([id, sample]) => ({ id, label: sample.label, path: [...sample.path] })),
  };
}
