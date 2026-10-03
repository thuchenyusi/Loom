import { Graph } from '@antv/g6';
import type { DiagramRenderer, GraphDiagramInstance, GraphIR, RenderOptions } from '../../core/types';
import { validateGraphPath } from '../../core/validator';

export class G6Renderer implements DiagramRenderer<GraphIR> {
  async mount(container: HTMLElement, diagram: GraphIR, options: RenderOptions = {}): Promise<GraphDiagramInstance> {
    const height = options.height ?? 560;
    if (!Number.isFinite(height) || height <= 0) throw new RangeError('height must be a positive finite number');
    const root = document.createElement('section');
    root.className = 'loom-diagram';
    root.style.cssText = 'font:14px system-ui,sans-serif;border:1px solid #dbe3ee;border-radius:12px;overflow:hidden;background:#fff;color:#182b49';
    const canvas = document.createElement('div');
    canvas.className = 'loom-canvas';
    canvas.style.height = `${height}px`;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Decision diagram${diagram.id ? `: ${diagram.id}` : ''}. ${diagram.nodes.map(node => node.label).join('; ')}`);
    const status = document.createElement('p');
    status.className = 'loom-status';
    status.setAttribute('aria-live', 'polite');
    status.style.cssText = 'margin:0;padding:10px 16px;border-top:1px solid #e8edf5;color:#53657e';
    status.textContent = '完整决策图 · 拖动平移，滚轮缩放';
    let selector: HTMLSelectElement | undefined;
    if (options.showSampleSelector !== false && diagram.samples.length) {
      const toolbar = document.createElement('div');
      toolbar.style.cssText = 'padding:12px 16px;border-bottom:1px solid #e8edf5';
      const label = document.createElement('label');
      label.textContent = 'Sample：';
      selector = document.createElement('select');
      selector.className = 'loom-sample-selector';
      selector.style.cssText = 'padding:6px 10px;margin-left:8px;border:1px solid #cbd5e1;border-radius:6px;background:white;color:inherit;font:inherit;max-width:100%';
      // Values are indexes so an arbitrary sample ID cannot collide with the reset option.
      selector.add(new Option('完整决策图 / All paths', ''));
      diagram.samples.forEach((sample, index) => selector!.add(new Option(sample.label, String(index))));
      label.append(selector);
      toolbar.append(label);
      root.append(toolbar);
    }
    root.append(canvas, status);
    container.append(root);
    let graph: Graph;
    try {
      graph = new Graph({
        container: canvas,
        width: Math.max(container.clientWidth || 800, 1), height,
        animation: false, autoFit: 'view', padding: 36,
        data: {
          nodes: diagram.nodes.map(node => ({ id: node.id, data: { kind: node.kind, label: node.label } })),
          edges: diagram.edges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target, data: { label: edge.label } })),
        },
        layout: { type: 'antv-dagre', rankdir: 'TB', nodeSize: [184, 56], nodesep: 30, ranksep: 36 },
        node: {
          type: 'rect',
          style: {
            size: [184, 56], radius: 10, lineWidth: 1.5, opacity: 1,
            fill: datum => datum.data?.kind === 'result' ? '#e7f6ec' : '#eef4ff',
            stroke: datum => datum.data?.kind === 'result' ? '#619a74' : '#7894bb',
            labelText: datum => String(datum.data?.label ?? datum.id),
            labelPlacement: 'center', labelFill: '#182b49', labelFontSize: 13,
            labelWordWrap: true, labelMaxWidth: 164,
          },
          state: {
            highlight: { fill: '#dbeafe', stroke: '#2563eb', lineWidth: 3 },
            dim: { opacity: 0.22 },
          },
        },
        edge: {
          type: 'polyline',
          style: {
            stroke: '#94a3b8', lineWidth: 1.5, endArrow: true, radius: 8, opacity: 1,
            labelText: datum => String(datum.data?.label ?? ''), labelFontSize: 11,
            labelFill: '#526681', labelBackground: true, labelBackgroundFill: '#fff',
          },
          state: { highlight: { stroke: '#2563eb', lineWidth: 3, labelFill: '#2563eb' }, dim: { opacity: 0.16 } },
        },
        behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
      });
    } catch (error) {
      root.remove();
      throw error;
    }
    try { await graph.render(); } catch (error) {
      graph.destroy();
      root.remove();
      throw error;
    }
    let destroyed = false;
    let pending: Promise<void> = Promise.resolve();
    const enqueue = (operation: () => Promise<void>): Promise<void> => {
      if (destroyed) return Promise.reject(new Error('Diagram has been destroyed'));
      const next = pending.then(async () => {
        if (destroyed) throw new Error('Diagram has been destroyed');
        await operation();
      });
      pending = next.catch(() => {});
      return next;
    };
    const states = (path?: readonly string[]): Record<string, string[]> => {
      const visited = new Set(path);
      const steps = new Set(path?.slice(1).map((target, index) => JSON.stringify([path[index], target])));
      return Object.fromEntries([
        ...diagram.nodes.map(node => [node.id, path ? [visited.has(node.id) ? 'highlight' : 'dim'] : []]),
        ...diagram.edges.map(edge => [edge.id, path ? [steps.has(JSON.stringify([edge.source, edge.target])) ? 'highlight' : 'dim'] : []]),
      ]);
    };
    const instance: GraphDiagramInstance = {
      highlightPath(path) {
        try { validateGraphPath(diagram, path); } catch (error) { return Promise.reject(error); }
        const snapshot = [...path];
        return enqueue(async () => {
          await graph.setElementState(states(snapshot), false);
          const sampleIndex = diagram.samples.findIndex(sample => sample.path.length === snapshot.length && sample.path.every((id, index) => id === snapshot[index]));
          if (selector) selector.value = sampleIndex >= 0 ? String(sampleIndex) : '';
          status.textContent = `当前路径：${snapshot.map(id => diagram.nodes.find(node => node.id === id)!.label).join(' → ')}`;
        });
      },
      clearHighlight() {
        return enqueue(async () => {
          await graph.setElementState(states(), false);
          if (selector) selector.value = '';
          status.textContent = '完整决策图 · 拖动平移，滚轮缩放';
        });
      },
      resize() {
        return enqueue(async () => {
          graph.setSize(Math.max(container.clientWidth || 800, 1), height);
          await graph.fitView();
        });
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        selector?.removeEventListener('change', onChange);
        graph.destroy();
        root.remove();
      },
    };
    const onChange = () => {
      const selected = selector!.value;
      const operation = selected === '' ? instance.clearHighlight() : instance.highlightPath(diagram.samples[Number(selected)].path);
      void operation.catch(error => { if (!destroyed) status.textContent = `路径更新失败：${String(error)}`; });
    };
    selector?.addEventListener('change', onChange);
    return instance;
  }
}
