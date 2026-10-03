export interface FunctionDSL {
  $schema?: string;
  type: 'function';
  id?: string;
  expression: string;
  domain: { x: [number, number]; y: [number, number] };
  interactive?: { point?: { x: number }; showCoordinate?: boolean };
}
