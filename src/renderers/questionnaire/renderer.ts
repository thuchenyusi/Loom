import { QuestionnaireSession } from '../../core/questionnaire';
import { DiagramEventEmitter } from '../../core/events';
import type { DiagramRenderer, GraphDiagramInstance, GraphIR, QuestionnaireDiagramInstance, RenderOptions } from '../../core/types';
import { G6Renderer } from '../g6/renderer';
import { questionnaireStyles } from './styles';

let nextId = 0;
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const button = (className: string, text: string): HTMLButtonElement => {
  const node = element('button', className, text);
  node.type = 'button';
  return node;
};

export class QuestionnaireRenderer implements DiagramRenderer<GraphIR, QuestionnaireDiagramInstance> {
  async mount(container: HTMLElement, diagram: GraphIR, options: RenderOptions = {}): Promise<QuestionnaireDiagramInstance> {
    const height = options.height ?? 560;
    if (!Number.isFinite(height) || height <= 0) throw new RangeError('height must be a positive finite number');
    const session = new QuestionnaireSession(diagram);
    const nodes = new Map(diagram.nodes.map(node => [node.id, node]));
    const groups = new Map(diagram.groups.map(group => [group.id, group]));
    const events = new DiagramEventEmitter();
    const root = element('section', 'loom-questionnaire');
    const style = element('style', '');
    style.textContent = questionnaireStyles;
    const shell = element('div', 'loom-questionnaire-shell');
    const toolbar = element('div', 'loom-questionnaire-toolbar');
    const flowButton = button('loom-questionnaire-button', '流程图');
    flowButton.setAttribute('aria-haspopup', 'dialog');
    toolbar.append(element('span', 'loom-questionnaire-brand', 'LOOM / 决策问卷'));
    const body = element('div', 'loom-questionnaire-body');
    const feedback = element('p', 'loom-questionnaire-feedback');
    feedback.setAttribute('role', 'status');
    const footer = element('div', 'loom-questionnaire-footer');
    const reviewArea = element('div', 'loom-questionnaire-review');
    const actions = element('div', 'loom-questionnaire-actions');
    actions.setAttribute('role', 'group');
    actions.setAttribute('aria-label', '问卷操作');
    const backButton = button('loom-questionnaire-button loom-questionnaire-back', '上一题');
    const restartButton = button('loom-questionnaire-button loom-questionnaire-restart', '重新开始');
    actions.append(backButton, flowButton, restartButton);
    footer.append(reviewArea, actions, feedback);
    shell.append(toolbar, body, footer);

    const dialog = element('dialog', 'loom-questionnaire-flow');
    const dialogTitle = element('h2', '', '作答流程图');
    dialog.id = 'loom-questionnaire-flow-' + nextId++;
    dialogTitle.id = dialog.id + '-title';
    dialog.setAttribute('aria-labelledby', dialogTitle.id);
    flowButton.setAttribute('aria-controls', dialog.id);
    flowButton.setAttribute('aria-expanded', 'false');
    const dialogHeader = element('div', 'loom-questionnaire-flow-header');
    const closeButton = button('loom-questionnaire-button', '返回问卷');
    closeButton.autofocus = true;
    dialogHeader.append(dialogTitle, closeButton);
    const hint = element('p', 'loom-questionnaire-flow-hint', '蓝色是已访问路线，橙色是当前位置。点击已访问节点或下方记录可跳转；改选会更新后续路线。');
    const dialogFeedback = element('p', 'loom-questionnaire-feedback');
    dialogFeedback.setAttribute('role', 'status');
    const content = element('div', 'loom-questionnaire-flow-content');
    const flowContainer = element('div', 'loom-questionnaire-flow-graph');
    const visits = element('ol', 'loom-questionnaire-flow-steps');
    visits.setAttribute('aria-label', '访问记录');
    content.append(flowContainer, visits);
    dialog.append(dialogHeader, hint, dialogFeedback, content);
    root.append(style, shell, dialog);
    container.append(root);

    let destroyed = false;
    let busy = false;
    let graph: GraphDiagramInstance | undefined;
    let unsubscribe: (() => void) | undefined;
    let flowTask: Promise<void> | undefined;
    let flowRevision = 0;
    let pending = Promise.resolve();
    const assertAlive = () => { if (destroyed) throw new Error('Questionnaire has been destroyed'); };

    const renderVisits = () => {
      const state = session.getState();
      visits.replaceChildren();
      state.path.forEach((id, index) => {
        const li = element('li', '');
        const answer = state.answers[index];
        const node = nodes.get(id)!;
        const visit = button('loom-questionnaire-flow-step', '');
        visit.dataset.position = String(index);
        visit.dataset.kind = node.kind;
        const meta = element('span', 'loom-questionnaire-flow-step-meta');
        meta.append(element('span', '', '步骤 ' + (index + 1) + (node.kind === 'result' ? ' · 推荐结果' : ' · 问题')));
        if (state.position === index) {
          visit.setAttribute('aria-current', 'step');
          meta.append(element('span', 'loom-questionnaire-flow-step-current', '当前位置'));
        }
        visit.append(meta, element('span', 'loom-questionnaire-flow-step-title', node.label));
        if (node.kind === 'decision') {
          const selection = element('span', 'loom-questionnaire-flow-step-answer');
          selection.append(
            element('span', 'loom-questionnaire-flow-step-caption', '已选答案'),
            element('span', 'loom-questionnaire-flow-step-value', answer ? answer.label : '尚未选择'),
          );
          visit.append(selection);
        }
        visit.onclick = () => run(async () => { await instance.jumpTo(index); instance.hideFlowchart(); });
        li.append(visit);
        visits.append(li);
      });
    };
    const renderQuestion = (focus = false) => {
      const state = session.getState();
      const node = nodes.get(state.currentNodeId)!;
      body.replaceChildren();
      reviewArea.replaceChildren();
      const progress = state.completed ? '推荐结果 · 已选择 ' + state.position + ' 次'
        : '问题 ' + (state.position + 1) + (state.answers[state.position] ? ' · 查看已有选择' : ' · 请选择一个选项');
      body.append(element('p', 'loom-questionnaire-progress', progress));
      const heading = element('h2', 'loom-questionnaire-heading', node.label);
      heading.tabIndex = -1;
      if (state.completed) {
        const result = element('div', 'loom-questionnaire-result');
        result.append(heading);
        body.append(result);
        if (state.position) {
          reviewArea.append(element('h3', 'loom-questionnaire-history-title', '你的选择 · 点击可返回修改'));
          const summary = element('ol', 'loom-questionnaire-summary');
          state.answers.slice(0, state.position).forEach((answer, index) => {
            const li = element('li', '');
            const review = button('', nodes.get(answer.nodeId)!.label + ' → ' + answer.label);
            review.disabled = busy;
            review.onclick = () => run(() => instance.jumpTo(index));
            li.append(review);
            summary.append(li);
          });
          reviewArea.append(summary);
        }
      } else {
        body.append(heading);
        const choices = element('div', 'loom-questionnaire-choices');
        choices.setAttribute('role', 'group');
        choices.setAttribute('aria-label', node.label);
        diagram.edges.filter(edge => edge.source === node.id).forEach((edge, index) => {
          const choice = button('loom-questionnaire-choice', '');
          choice.dataset.branch = edge.branch;
          choice.setAttribute('aria-pressed', String(state.answers[state.position]?.branch === edge.branch));
          choice.disabled = busy;
          choice.append(element('span', 'loom-questionnaire-choice-number', String(index + 1)), element('span', 'loom-questionnaire-choice-text', edge.label));
          if (state.answers[state.position]?.branch === edge.branch) choice.append(element('span', 'loom-questionnaire-choice-selected', '已选择'));
          choice.onclick = () => run(() => instance.choose(edge.branch));
          choices.append(choice);
        });
        body.append(choices);
      }
      backButton.disabled = busy || state.position === 0;
      restartButton.disabled = busy || state.path.length === 1;
      body.setAttribute('aria-busy', String(busy));
      if (focus && !dialog.open) heading.focus({ preventScroll: true });
      renderVisits();
    };
    const syncFlow = async () => {
      if (!graph || destroyed) return;
      const revision = ++flowRevision;
      const state = session.getState();
      const visitedGroups = new Set<string>();
      for (const id of state.path) {
        let group = nodes.get(id)?.group;
        while (group) { visitedGroups.add(group); group = groups.get(group)?.parent; }
      }
      for (const group of visitedGroups) {
        if (destroyed || revision !== flowRevision) return;
        await graph.expand(group);
      }
      if (!destroyed && revision === flowRevision) await graph.highlightPath(state.path, { branches: state.answers.map(answer => answer.branch), currentNodeId: state.currentNodeId });
    };
    const enqueue = (operation: () => void): Promise<void> => {
      if (destroyed) return Promise.reject(new Error('Questionnaire has been destroyed'));
      const next = pending.then(async () => {
        assertAlive();
        operation();
        feedback.textContent = '';
        dialogFeedback.textContent = '';
        renderQuestion();
        events.emit('change', { kind: 'questionnaire', value: session.getState() });
        await syncFlow();
      });
      pending = next.catch(() => {});
      return next;
    };
    const run = (operation: () => Promise<void>) => {
      if (busy || destroyed) return;
      busy = true;
      renderQuestion();
      void operation().catch(error => {
        if (!destroyed) (dialog.open ? dialogFeedback : feedback).textContent = error instanceof Error ? error.message : String(error);
      }).finally(() => {
        busy = false;
        if (!destroyed) renderQuestion(true);
      });
    };
    const instance: QuestionnaireDiagramInstance = {
      kind: 'questionnaire',
      getState() { assertAlive(); return session.getState(); },
      on(event, listener) { assertAlive(); return events.on(event, listener); },
      choose: id => enqueue(() => session.choose(id)),
      back: () => enqueue(() => session.back()),
      jumpTo: position => enqueue(() => session.jumpTo(position)),
      restart: () => enqueue(() => session.restart()),
      async showFlowchart() {
        if (destroyed) return Promise.reject(new Error('Questionnaire has been destroyed'));
        if (!dialog.open) dialog.showModal();
        flowButton.setAttribute('aria-expanded', 'true');
        if (flowTask) return flowTask;
        flowTask = (async () => {
          if (!graph) {
            const mounted = await new G6Renderer().mount(flowContainer, diagram, { height: Math.min(height, 480), showSampleSelector: false });
            if (destroyed) { mounted.destroy(); throw new Error('Questionnaire has been destroyed'); }
            graph = mounted;
            unsubscribe = graph.on('nodeclick', ({ nodeId }) => {
              const position = session.getState().path.lastIndexOf(nodeId);
              if (position < 0) { dialogFeedback.textContent = '尚未访问这个节点，请先在问卷中完成前面的选择。'; return; }
              run(async () => { await instance.jumpTo(position); instance.hideFlowchart(); });
            });
          }
          if (!destroyed) { await graph.resize(); await syncFlow(); }
        })().finally(() => { flowTask = undefined; });
        return flowTask;
      },
      hideFlowchart() { assertAlive(); if (dialog.open) dialog.close(); },
      async resize() { assertAlive(); if (dialog.open) await graph?.resize(); },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        dialog.onclose = null;
        if (dialog.open) dialog.close();
        unsubscribe?.();
        graph?.destroy();
        events.clear();
        root.remove();
      },
    };
    flowButton.onclick = () => run(() => instance.showFlowchart());
    backButton.onclick = () => run(() => instance.back());
    restartButton.onclick = () => run(() => instance.restart());
    closeButton.onclick = () => instance.hideFlowchart();
    dialog.onclose = () => {
      flowButton.setAttribute('aria-expanded', 'false');
      if (!destroyed) flowButton.focus();
    };
    renderQuestion();
    return instance;
  }
}
