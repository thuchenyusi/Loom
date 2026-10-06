import type { GraphIR, GraphNodeIR, QuestionnaireAnswer, QuestionnaireState } from './types';

/** A visit history with a review cursor, rather than a map keyed by node ID (graphs may loop). */
export class QuestionnaireSession {
  private path: string[];
  private answers: QuestionnaireAnswer[] = [];
  private position = 0;
  private nodes: Map<string, GraphNodeIR>;
  private diagram: GraphIR;

  constructor(diagram: GraphIR) {
    this.diagram = structuredClone(diagram);
    this.nodes = new Map(this.diagram.nodes.map(node => [node.id, node]));
    this.path = [diagram.start];
  }

  getState(): QuestionnaireState {
    const currentNodeId = this.path[this.position];
    const node = this.nodes.get(currentNodeId)!;
    return {
      path: [...this.path], answers: structuredClone(this.answers), position: this.position,
      currentNodeId, completed: node.kind === 'result',
      ...(node.kind === 'result' ? { result: structuredClone(node) } : {}),
    };
  }

  choose(branchId: string): void {
    const nodeId = this.path[this.position];
    if (this.nodes.get(nodeId)!.kind !== 'decision') throw new Error('The current node is a result');
    const edge = this.diagram.edges.find(edge => edge.source === nodeId && edge.branch === branchId);
    if (!edge) throw new Error('Unknown branch "' + branchId + '" at node "' + nodeId + '"');
    // Replaying the same answer keeps later history available for review.
    if (this.answers[this.position]?.branch !== branchId) {
      this.path = this.path.slice(0, this.position + 1);
      this.answers = this.answers.slice(0, this.position);
      this.answers.push({ nodeId, branch: edge.branch, target: edge.target, label: edge.label });
      this.path.push(edge.target);
    }
    this.position++;
  }

  back(): void { if (this.position > 0) this.position--; }

  jumpTo(position: number): void {
    if (!Number.isInteger(position) || position < 0 || position >= this.path.length) throw new RangeError('Unknown history position');
    this.position = position;
  }

  restart(): void {
    this.path = [this.diagram.start];
    this.answers = [];
    this.position = 0;
  }
}
