export interface DecisionBranchDSL {
  target: string;
  label: string;
}
interface DecisionNodeBaseDSL {
  type: 'decision';
  label: string;
  group?: string;
  metadata?: Record<string, unknown>;
}
export type DecisionNodeDSL = DecisionNodeBaseDSL & (
  | { yes: string; no: string; branches?: never }
  | { branches: Record<string, DecisionBranchDSL>; yes?: never; no?: never }
);
export interface ResultNodeDSL {
  type: 'result';
  label: string;
  group?: string;
  metadata?: Record<string, unknown>;
}
export interface DecisionDSL {
  $schema?: string;
  type: 'decision';
  id?: string;
  start: string;
  nodes: Record<string, DecisionNodeDSL | ResultNodeDSL>;
  groups?: Record<string, { label: string; collapsed?: boolean; parent?: string }>;
  samples?: Record<string, { label: string; path: string[] }>;
}
