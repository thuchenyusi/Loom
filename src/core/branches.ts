import type { DecisionNodeDSL } from '../dsl/decision';

/** Normalize both DSL forms without tying branch identity to its displayed label. */
export function decisionBranches(node: DecisionNodeDSL): { id: string; target: string; label: string }[] {
  if (node.branches) {
    return Object.entries(node.branches).map(([id, branch]) => ({ id, target: branch.target, label: branch.label }));
  }
  return [
    { id: 'yes', target: node.yes, label: '是 / Yes' },
    { id: 'no', target: node.no, label: '否 / No' },
  ];
}
