import JXG from 'jsxgraph';
import type { Board, BoardAttributes } from 'jsxgraph';
import { DiagramEventEmitter } from '../../core/events';
import type { DiagramRenderer, FunctionDiagramInstance, FunctionIR, RenderOptions } from '../../core/types';

let nextBoardId = 0;
export class JSXGraphRenderer implements DiagramRenderer<FunctionIR, FunctionDiagramInstance> {
  async mount(container: HTMLElement, diagram: FunctionIR, options: RenderOptions = {}): Promise<FunctionDiagramInstance> {
    const height = options.height ?? 560;
    if (!Number.isFinite(height) || height <= 0) throw new RangeError('height must be a positive finite number');
    const root = document.createElement('section');
    root.className = 'loom-diagram loom-function';
    root.style.cssText = 'border:1px solid #dbe3ee;border-radius:12px;overflow:hidden;background:white;font:14px system-ui;color:#182b49';
    const title = document.createElement('p');
    title.textContent = `y = ${diagram.expression}`;
    title.style.cssText = 'margin:0;padding:12px 16px;border-bottom:1px solid #e8edf5';
    const canvas = document.createElement('div');
    do { canvas.id = `loom-function-${++nextBoardId}`; } while (document.getElementById(canvas.id));
    canvas.className = 'loom-function-canvas';
    canvas.style.cssText = `position:relative;overflow:hidden;touch-action:none;height:${height}px;width:100%`;
    canvas.setAttribute('aria-label', `Function graph: y = ${diagram.expression}. Drag point P along the curve.`);
    const coordinate = document.createElement('p');
    coordinate.className = 'loom-coordinate';
    coordinate.setAttribute('aria-live', 'polite');
    coordinate.style.cssText = 'margin:0;padding:10px 16px;border-top:1px solid #e8edf5';
    coordinate.hidden = !diagram.showCoordinate;
    root.append(title, canvas, coordinate);
    container.append(root);
    let board: Board | undefined;
    try {
      // JSXGraph supports keyboard options at runtime but omits them from BoardAttributes.
      const boardOptions: Partial<BoardAttributes> & { keyboard: { enabled: boolean } } = {
        boundingbox: [diagram.domain.x[0], diagram.domain.y[1], diagram.domain.x[1], diagram.domain.y[0]],
        axis: true, showNavigation: false, showCopyright: false, keepaspectratio: false,
        resize: { enabled: false, throttle: 100 }, pan: { enabled: false }, zoom: { wheel: false },
        renderer: 'svg', keyboard: { enabled: false },
      };
      board = JXG.JSXGraph.initBoard(canvas, boardOptions);
      const curve = board.create('functiongraph', [(x: number) => {
        const value = diagram.evaluate(x); return Number.isFinite(value) ? value : NaN;
      }, ...diagram.domain.x], { strokeColor: '#2563eb', strokeWidth: 2 });
      const point = board.create('glider', [diagram.pointX, diagram.evaluate(diagram.pointX), curve], {
        name: 'P', size: 5, fillColor: '#2563eb', strokeColor: '#fff', strokeWidth: 2, withLabel: false, showInfobox: false,
      });
      // Stable accessible target for keyboard and pointer interaction.
      point.rendNode?.setAttribute('aria-label', 'Point P');
      point.rendNode?.setAttribute('tabindex', '0');
      point.rendNode?.setAttribute('role', 'slider');
      point.rendNode?.setAttribute('aria-valuemin', String(diagram.domain.x[0]));
      point.rendNode?.setAttribute('aria-valuemax', String(diagram.domain.x[1]));
      const events = new DiagramEventEmitter();
      let destroyed = false;
      let value = { x: point.X(), y: point.Y() };
      const updateCoordinate = () => {
        coordinate.textContent = `P(${value.x.toFixed(3)}, ${value.y.toFixed(3)})`;
        point.rendNode?.setAttribute('aria-valuenow', String(value.x));
        point.rendNode?.setAttribute('aria-valuetext', coordinate.textContent);
      };
      const update = () => {
        const x = Math.min(diagram.domain.x[1], Math.max(diagram.domain.x[0], point.X()));
        const y = diagram.evaluate(x);
        if (!Number.isFinite(y)) {
          point.setPosition(JXG.COORDS_BY_USER, [value.x, value.y]);
          board!.update(); return;
        }
        // Restore exact mathematical coordinates after JSXGraph's curve projection.
        point.setPosition(JXG.COORDS_BY_USER, [x, y]);
        board!.update();
        value = { x: point.X(), y: diagram.evaluate(point.X()) };
        updateCoordinate();
        events.emit('change', { kind: 'function', value: { ...value } });
      };
      point.on('drag', update);
      const onKey = (event: Event) => {
        const key = (event as KeyboardEvent).key;
        if (key !== 'ArrowLeft' && key !== 'ArrowRight') return;
        event.preventDefault();
        const x = Math.min(diagram.domain.x[1], Math.max(diagram.domain.x[0], value.x + (key === 'ArrowRight' ? 1 : -1) * (diagram.domain.x[1] - diagram.domain.x[0]) / 100));
        point.setPosition(JXG.COORDS_BY_USER, [x, diagram.evaluate(x)]);
        update();
      };
      point.rendNode?.addEventListener('keydown', onKey);
      updateCoordinate();
      return {
        kind: 'function',
        on(event, listener) { if (destroyed) throw new Error('Diagram has been destroyed'); return events.on(event, listener); },
        getValue() { if (destroyed) throw new Error('Diagram has been destroyed'); return { ...value }; },
        async resize() {
          if (destroyed) throw new Error('Diagram has been destroyed');
          board!.resizeContainer(Math.max(canvas.clientWidth || 800, 1), height);
        },
        destroy() {
          if (destroyed) return;
          destroyed = true;
          point.off('drag', update);
          point.rendNode?.removeEventListener('keydown', onKey);
          events.clear();
          JXG.JSXGraph.freeBoard(board!);
          root.remove();
        },
      };
    } catch (error) {
      if (board) JXG.JSXGraph.freeBoard(board);
      root.remove();
      throw error;
    }
  }
}
