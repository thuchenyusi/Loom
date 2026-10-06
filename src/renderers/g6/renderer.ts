import { Graph } from '@antv/g6';
import type { IPointerEvent } from '@antv/g6';
import { DiagramEventEmitter } from '../../core/events';
import type { DiagramRenderer, GraphDiagramInstance, GraphIR, RenderOptions } from '../../core/types';
import { validateGraphPath } from '../../core/validator';

export class G6Renderer implements DiagramRenderer<GraphIR, GraphDiagramInstance> {
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
    const events = new DiagramEventEmitter();
    const collapsed = new Set(diagram.groups.filter(group => group.collapsed).map(group => group.id));
    const groupButtons = new Map<string, HTMLButtonElement>();
    if (diagram.groups.length) {
      const controls = document.createElement('div');
      controls.className = 'loom-group-controls';
      controls.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid #e8edf5';
      diagram.groups.forEach(group => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.group = group.id;
        button.style.cssText = 'padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:inherit;font:inherit;cursor:pointer';
        groupButtons.set(group.id, button);
        controls.append(button);
      });
      root.append(controls);
    }
    const syncGroupButtons = () => diagram.groups.forEach(group => {
      const button = groupButtons.get(group.id)!;
      button.textContent = `${collapsed.has(group.id) ? '▸ 展开' : '▾ 收起'}：${group.label}`;
      button.setAttribute('aria-expanded', String(!collapsed.has(group.id)));
    });
    syncGroupButtons();
    root.append(canvas, status);
    container.append(root);
    // G6's combo collapse path reuses cached callback styles, so keep presentation in data.
    const groupPresentation = (id: string, isCollapsed: boolean) => ({
      labelText: `${diagram.groups.find(group => group.id === id)!.label}${isCollapsed ? '\n▸ 展开' : '  ▾ 收起'}`,
      labelBackground: !isCollapsed,
      padding: isCollapsed ? 0 : [24, 12, 12, 12],
      labelPlacement: isCollapsed ? 'center' as const : 'top' as const,
      labelMaxWidth: isCollapsed ? 164 : '90%',
      labelMaxLines: isCollapsed ? 3 : 1,
    });
    let canvasWidth = Math.max(container.clientWidth || 800, 1);
    let graph: Graph;
    try {
      graph = new Graph({
        container: canvas,
        width: canvasWidth, height,
        animation: false, autoFit: 'view', padding: 36,
        data: {
          nodes: diagram.nodes.map(node => ({ id: node.id, combo: node.group, data: { kind: node.kind, label: node.label } })),
          combos: diagram.groups.map(group => ({ id: group.id, combo: group.parent, data: { label: group.label }, style: groupPresentation(group.id, false) })),
          edges: diagram.edges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target, data: { label: edge.label } })),
        },
        layout: { type: 'antv-dagre', rankdir: 'TB', nodeSize: [184, 56], nodesep: 30, ranksep: 36, sortByCombo: true },
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
            current: { fill: '#fff3db', stroke: '#d97706', lineWidth: 3, cursor: 'pointer' },
            active: { lineWidth: 3 },
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
        combo: {
          type: 'rect',
          style: { radius: 10, fill: '#f6f8fc', stroke: '#94a3b8', lineWidth: 1, opacity: 1,
            cursor: 'pointer', labelCursor: 'pointer', labelFill: '#182b49', labelFontSize: 13, labelFontWeight: 400,
            labelWordWrap: true, labelLineHeight: 16, labelPadding: [2, 4],
            labelBackgroundFill: '#fff', labelBackgroundStroke: '#cbd5e1', labelBackgroundLineWidth: 1, labelBackgroundRadius: 4,
            collapsedSize: [184, 56], collapsedFill: '#f1f5f9', collapsedMarker: false },
          state: { highlight: { stroke: '#2563eb', lineWidth: 3 }, dim: { opacity: 0.22 }, active: { lineWidth: 2 } },
        },
        behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element', { type: 'hover-activate', animation: false }],

      });
    } catch (error) {
      root.remove();
      throw error;
    }
    const fitWithoutEnlarging = async () => {
      const zoom = graph.getZoom();
      await graph.fitView(undefined, false);
      // Keep labels at the same scale when folding removes content from the view.
      if (graph.getZoom() > zoom) {
        await graph.zoomTo(zoom, false);
        await graph.fitCenter(false);
      }
    };
    const groupDepth = (id: string): number => {
      let depth = 0;
      let parent = diagram.groups.find(group => group.id === id)?.parent;
      while (parent) { depth++; parent = diagram.groups.find(group => group.id === parent)?.parent; }
      return depth;
    };
    try {
      // Layout the full graph first; G6 reattaches external edges on collapse.
      await graph.render();
      for (const group of [...diagram.groups].sort((a, b) => groupDepth(b.id) - groupDepth(a.id))) {
        if (group.collapsed) {
          graph.updateComboData([{ id: group.id, style: groupPresentation(group.id, true) }]);
          await graph.collapseElement(group.id, false);
        }
      }
      if (collapsed.size) await fitWithoutEnlarging();
    } catch (error) {
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
    let currentPath: string[] | undefined;
    let currentBranches: string[] | undefined;
    let currentNodeId: string | undefined;
    const states = (path?: readonly string[]): Record<string, string[]> => {
      const visited = new Set(path);
      const steps = new Set(path?.slice(1).map((target, index) => JSON.stringify(currentBranches ? [path[index], target, currentBranches[index]] : [path[index], target])));
      const visitedGroups = new Set<string>();
      for (const node of diagram.nodes) {
        if (!visited.has(node.id)) continue;
        let groupId = node.group;
        while (groupId) { visitedGroups.add(groupId); groupId = diagram.groups.find(group => group.id === groupId)?.parent; }
      }
      return Object.fromEntries([
        ...diagram.groups.map(group => [group.id, path ? [visitedGroups.has(group.id) ? 'highlight' : 'dim'] : []]),
        ...diagram.nodes.map(node => [node.id, path ? [...(visited.has(node.id) ? ['highlight'] : ['dim']), ...(node.id === currentNodeId ? ['current'] : [])] : []]),
        ...diagram.edges.map(edge => [edge.id, path ? [steps.has(JSON.stringify(currentBranches ? [edge.source, edge.target, edge.branch] : [edge.source, edge.target])) ? 'highlight' : 'dim'] : []]),
      ]);
    };
    const assertGroup = (id: string) => { if (!diagram.groups.some(group => group.id === id)) throw new Error(`Unknown group "${id}"`); };
    const setCollapsed = (id: string, value: boolean) => enqueue(async () => {
      assertGroup(id);
      if (collapsed.has(id) === value) return;
      // A hidden child can still record its own collapsed flag for the next parent expansion.
      let parent = diagram.groups.find(group => group.id === id)?.parent;
      let hidden = false;
      while (parent) {
        if (collapsed.has(parent)) hidden = true;
        parent = diagram.groups.find(group => group.id === parent)?.parent;
      }
      if (hidden) {
        graph.updateComboData([{ id, style: { collapsed: value, ...groupPresentation(id, value) } }]);
      } else {
        graph.updateComboData([{ id, style: groupPresentation(id, value) }]);
        if (value) await graph.collapseElement(id, false);
        else await graph.expandElement(id, false);
      }
      if (value) collapsed.add(id); else collapsed.delete(id);
      await graph.setElementState(states(currentPath), false);
      await fitWithoutEnlarging();
      syncGroupButtons();
    });
    const instance: GraphDiagramInstance = {
      kind: 'graph',
      on: (event, listener) => {
        if (destroyed) throw new Error('Diagram has been destroyed');
        return events.on(event, listener);
      },
      collapse: id => setCollapsed(id, true),
      expand: id => setCollapsed(id, false),
      focus: id => enqueue(async () => {
        const node = diagram.nodes.find(node => node.id === id);
        if (!node) throw new Error(`Unknown node "${id}"`);
        const ancestors: string[] = [];
        let groupId = node.group;
        while (groupId) { ancestors.unshift(groupId); groupId = diagram.groups.find(group => group.id === groupId)?.parent; }
        for (const ancestor of ancestors) if (collapsed.has(ancestor)) {
          graph.updateComboData([{ id: ancestor, style: groupPresentation(ancestor, false) }]);
          await graph.expandElement(ancestor, false);
          collapsed.delete(ancestor);
        }
        await graph.setElementState(states(currentPath), false);
        syncGroupButtons();
        await graph.focusElement(id, false);
      }),
      highlightPath(path, pathOptions = {}) {
        try { validateGraphPath(diagram, path, pathOptions); } catch (error) { return Promise.reject(error); }
        const snapshot = [...path];
        const branches = pathOptions.branches ? [...pathOptions.branches] : undefined;
        const nodeId = pathOptions.currentNodeId;
        return enqueue(async () => {
          currentPath = snapshot;
          currentBranches = branches;
          currentNodeId = nodeId;
          await graph.setElementState(states(snapshot), false);
          const sampleIndex = diagram.samples.findIndex(sample => sample.path.length === snapshot.length && sample.path.every((id, index) => id === snapshot[index]));
          if (selector) selector.value = sampleIndex >= 0 ? String(sampleIndex) : '';
          status.textContent = `当前路径：${snapshot.map(id => diagram.nodes.find(node => node.id === id)!.label).join(' → ')}`;
          events.emit('change', { kind: 'graph', value: { path: [...snapshot] } });
        });
      },
      clearHighlight() {
        return enqueue(async () => {
          currentPath = undefined;
          currentBranches = undefined;
          currentNodeId = undefined;
          await graph.setElementState(states(), false);
          if (selector) selector.value = '';
          status.textContent = '完整决策图 · 拖动平移，滚轮缩放';
          events.emit('change', { kind: 'graph', value: { path: null } });
        });
      },
      resize() {
        return enqueue(async () => {
          const width = Math.max(container.clientWidth || 800, 1);
          if (width === canvasWidth) return;
          canvasWidth = width;
          graph.setSize(width, height);
          await graph.fitView(undefined, false);
        });
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        selector?.removeEventListener('change', onChange);
        groupButtons.forEach(button => { button.onclick = null; });
        graph.off('combo:click', onComboClick);
        graph.off('node:click', onNodeClick);
        events.clear();
        graph.destroy();
        root.remove();
      },
    };
    const onChange = () => {
      const selected = selector!.value;
      const operation = selected === '' ? instance.clearHighlight() : instance.highlightPath(diagram.samples[Number(selected)].path);
      void operation.catch(error => { if (!destroyed) status.textContent = `路径更新失败：${String(error)}`; });
    };
    const toggleGroup = (id: string) => {
      const operation = collapsed.has(id) ? instance.expand(id) : instance.collapse(id);
      void operation.catch(error => { if (!destroyed) status.textContent = `分组更新失败：${String(error)}`; });
    };
    const onComboClick = (event: IPointerEvent) => { if ('id' in event.target) toggleGroup(event.target.id); };
    const onNodeClick = (event: IPointerEvent) => { if ('id' in event.target) events.emit('nodeclick', { nodeId: event.target.id }); };
    groupButtons.forEach((button, id) => { button.onclick = () => toggleGroup(id); });
    graph.on('combo:click', onComboClick);
    graph.on('node:click', onNodeClick);
    selector?.addEventListener('change', onChange);
    return instance;
  }
}
