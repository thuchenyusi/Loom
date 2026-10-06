import { describe, expect, it } from 'vitest';
import example from '../examples/multi-branch.json';
import { parseDecisionDSL } from '../src/core/parser';
import { validateDecisionDSL, validateGraphPath } from '../src/core/validator';
import type { DecisionDSL } from '../src/dsl/decision';

const spec = example as DecisionDSL;
const choice = (branches: unknown, extra = {}) => ({ type: 'decision', start: 'q', nodes: {
  q: { type: 'decision', label: 'Choose', branches, ...extra },
  a: { type: 'result', label: 'A' }, b: { type: 'result', label: 'B' }, c: { type: 'result', label: 'C' },
} });

describe('Multi-branch decisions', () => {
  it('accepts mixed forms and preserves custom labels, identities and paths', () => {
    const ir = parseDecisionDSL(spec);
    expect(ir.edges.filter(edge => edge.source === 'cyberpunk')).toHaveLength(3);
    expect(ir.edges).toContainEqual(expect.objectContaining({ source: 'cyberpunk', target: 'cryptonomicon', branch: 'maybe', label: 'Maybe · 技术多一点，压抑少一点' }));
    expect(ir.edges).toContainEqual(expect.objectContaining({ source: 'style', branch: 'noir', label: '黑色风格 / Noir' }));
    expect(ir.edges).toContainEqual(expect.objectContaining({ source: 'space', branch: 'yes', label: '是 / Yes' }));
    for (const sample of ir.samples) expect(() => validateGraphPath(ir, sample.path)).not.toThrow();
    expect(() => validateGraphPath(ir, ['cyberpunk', 'style'])).not.toThrow();
    expect(() => validateGraphPath(ir, ['cyberpunk', 'contact'])).toThrow('INVALID_SAMPLE_PATH');
  });
  it.each([1, 2, 3, 6])('supports %i labeled branches including shared targets', count => {
    const branches = Object.fromEntries(Array.from({length:count}, (_, i) => [String(i), {target:'a', label:'选项'}]));
    const ir = parseDecisionDSL(choice(branches));
    expect(ir.edges).toHaveLength(count);
    expect(new Set(ir.edges.map(edge => edge.id)).size).toBe(count);
  });
  it.each([
    {}, [], {x:'a'}, {x:{target:'a'}}, {x:{label:'X'}}, {x:{target:'',label:'X'}},
    {x:{target:'a',label:''}}, {'':{target:'a',label:'X'}}, {x:{target:'a',label:'X',unknown:true}},
  ])('rejects malformed branch definitions: %j', branches => {
    expect(validateDecisionDSL(choice(branches))).toMatchObject({valid:false});
  });
  it.each([{yes:'a'}, {no:'a'}, {yes:'a',no:'b'}])('rejects mixing both forms on one node: %j', extra => {
    expect(validateDecisionDSL(choice({x:{target:'a',label:'X'}},extra))).toMatchObject({valid:false});
  });
  it('reports escaped target pointers and rejects disconnected sample steps', () => {
    expect(validateDecisionDSL(choice({'maybe/~':{target:'missing',label:'Maybe'}})).errors).toContainEqual(
      expect.objectContaining({code:'TARGET_NODE_NOT_FOUND',path:'/nodes/q/branches/maybe~1~0/target'}),
    );
    const invalid = structuredClone(example);
    invalid.samples.maybe.path = ['cyberpunk','contact'];
    expect(validateDecisionDSL(invalid).errors).toContainEqual(expect.objectContaining({code:'INVALID_SAMPLE_PATH'}));
    invalid.samples.maybe.path = ['cyberpunk','style'];
    expect(validateDecisionDSL(invalid).errors).toContainEqual(expect.objectContaining({code:'INVALID_SAMPLE_PATH',message:'Sample must end at a result node'}));
  });
  it('handles prototype-like branch IDs and collisions with element IDs', () => {
    const input = choice(JSON.parse('{"__proto__":{"target":"a","label":"原型"},"constructor":{"target":"b","label":"构造"}}'));
    const collision = 'edge:' + JSON.stringify(['q','__proto__']);
    Object.assign(input.nodes, {[collision]:{type:'result',label:'Collision'}});
    const ir = parseDecisionDSL(input);
    expect(ir.edges.map(edge => edge.branch)).toEqual(['__proto__','constructor']);
    expect(new Set([...ir.nodes,...ir.edges].map(item => item.id)).size).toBe(ir.nodes.length + ir.edges.length);
  });
});
