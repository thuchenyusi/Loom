export interface DecisionNodeDSL {
  type: 'decision';
  label: string;
  yes: string;
  no: string;
  metadata?: Record<string, unknown>;
}

export interface ResultNodeDSL {
  type: 'result';
  label: string;
  metadata?: Record<string, unknown>;
}

export interface DecisionDSL {
  $schema?: string;
  type: 'decision';
  id?: string;
  start: string;
  nodes: Record<string, DecisionNodeDSL | ResultNodeDSL>;
  samples?: Record<string, { label: string; path: string[] }>;
}
