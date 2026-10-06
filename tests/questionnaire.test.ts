import { describe, expect, it } from 'vitest';
import spec from '../examples/multi-branch.json';
import { parseDecisionDSL } from '../src/core/parser';
import { QuestionnaireSession } from '../src/core/questionnaire';

const create = () => new QuestionnaireSession(parseDecisionDSL(spec));
describe('Questionnaire history', () => {
  it('follows labeled choices to a result, retains history on back and replays the same route', () => {
    const session = create();
    expect(session.getState()).toMatchObject({position:0,path:['cyberpunk'],completed:false});
    session.choose('yes'); session.choose('noir');
    expect(session.getState()).toMatchObject({position:2,completed:true,result:{id:'neuromancer'},answers:[{branch:'yes'},{branch:'noir'}]});
    session.back(); session.back();
    expect(session.getState()).toMatchObject({position:0,path:['cyberpunk','style','neuromancer']});
    session.choose('yes');
    expect(session.getState()).toMatchObject({position:1,path:['cyberpunk','style','neuromancer']});
    session.jumpTo(2);
    expect(session.getState().result?.id).toBe('neuromancer');
  });
  it('replaces downstream choices and results when an earlier answer changes', () => {
    const session = create();
    session.choose('yes'); session.choose('noir'); session.jumpTo(0); session.choose('no');
    expect(session.getState()).toMatchObject({position:1,path:['cyberpunk','space'],answers:[{branch:'no'}],completed:false});
    expect(session.getState().answers).toHaveLength(1);
    expect(() => session.jumpTo(2)).toThrow('Unknown history position');
    session.choose('yes');
    expect(session.getState().result?.id).toBe('contact');
    session.restart();
    expect(session.getState()).toEqual({position:0,path:['cyberpunk'],answers:[],currentNodeId:'cyberpunk',completed:false});
  });
  it('distinguishes parallel branch identities even when they share a target', () => {
    const input = structuredClone(spec);
    input.nodes.cyberpunk.branches.maybe.target = 'style';
    input.samples.maybe.path = ['cyberpunk','style','snow-crash'];
    const session = new QuestionnaireSession(parseDecisionDSL(input));
    session.choose('yes'); session.choose('noir'); session.jumpTo(0); session.choose('maybe');
    expect(session.getState().path).toEqual(['cyberpunk','style']);
    expect(session.getState().answers[0]).toMatchObject({branch:'maybe',label:'Maybe · 技术多一点，压抑少一点'});
  });
  it('handles loops and repeated visits by position', () => {
    const session = new QuestionnaireSession(parseDecisionDSL({type:'decision',start:'q',nodes:{
      q:{type:'decision',label:'Loop?',yes:'q',no:'done'},done:{type:'result',label:'Done'},
    }}));
    session.choose('yes'); session.choose('yes'); session.choose('no');
    expect(session.getState().path).toEqual(['q','q','q','done']);
    session.jumpTo(1); session.choose('no');
    expect(session.getState()).toMatchObject({path:['q','q','done'],position:2,completed:true});
  });
  it('rejects invalid choices, invalid jumps and choosing from a result without changing state', () => {
    const session = create();
    session.back();
    const initial = session.getState();
    expect(() => session.choose('missing')).toThrow('Unknown branch');
    for (const index of [-1,1,0.5,NaN,Infinity]) expect(() => session.jumpTo(index)).toThrow('Unknown history position');
    expect(session.getState()).toEqual(initial);
    session.choose('maybe');
    expect(() => session.choose('yes')).toThrow('result');
  });
  it('supports a result start and isolates caller mutations from retained state', () => {
    const session = new QuestionnaireSession(parseDecisionDSL({type:'decision',start:'done',nodes:{done:{type:'result',label:'Done',metadata:{book:{author:'A'}}}}}));
    const state = session.getState();
    state.path.push('fake'); state.result!.metadata!.book = null;
    expect(session.getState()).toMatchObject({path:['done'],completed:true,result:{metadata:{book:{author:'A'}}}});
    const history = create(); history.choose('yes');
    history.getState().answers[0].branch = 'no';
    expect(history.getState().answers[0].branch).toBe('yes');
  });
});
