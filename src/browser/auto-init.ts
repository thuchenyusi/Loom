import { renderDiagram } from './render';
import type { RenderedDiagramInstance, RenderOptions } from '../core/types';

export type InitDiagramResult =
  | { container: HTMLElement; instance: RenderedDiagramInstance; error?: never }
  | { container: HTMLElement; instance?: never; error: unknown };
interface InitRecord {
  promise: Promise<InitDiagramResult>;
  controller: AbortController;
  instance?: RenderedDiagramInstance;
  errorElement?: HTMLElement;
  cancelled: boolean;
}
const records = new WeakMap<HTMLElement, InitRecord>();
function containers(root: ParentNode): HTMLElement[] {
  const results = Array.from(root.querySelectorAll<HTMLElement>('[data-diagram]'));
  if (root instanceof HTMLElement && root.matches('[data-diagram]')) results.unshift(root);
  return results;
}
/** Initialize each container independently; repeated/concurrent calls reuse the same instance. */
export async function initDiagrams(root: ParentNode = document, options: RenderOptions = {}): Promise<InitDiagramResult[]> {
  return Promise.all(containers(root).map(container => {
    const previous = records.get(container);
    if (previous) return previous.promise;
    const controller = new AbortController();
    const record: InitRecord = { controller, cancelled: false, promise: Promise.resolve({ container, error: new Error('Not initialized') }) };
    records.set(container, record);
    container.dataset.diagramState = 'loading';
    const onAbort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    if (options.signal?.aborted) onAbort();
    record.promise = (async (): Promise<InitDiagramResult> => {
      try {
        const source = container.dataset.src;
        if (!source) throw new Error('Diagram container requires data-src');
        const height = container.dataset.height ? Number(container.dataset.height) : options.height;
        const instance = await renderDiagram(container, source, { ...options, height, signal: controller.signal });
        if (record.cancelled) { instance.destroy(); throw new DOMException('Initialization cancelled', 'AbortError'); }
        record.instance = instance;
        const destroy = instance.destroy.bind(instance);
        instance.destroy = () => {
          destroy();
          options.signal?.removeEventListener('abort', onAbort);
          if (records.get(container) === record) {
            records.delete(container);
            delete container.dataset.diagramState;
          }
        };
        container.dataset.diagramState = 'ready';
        return { container, instance };
      } catch (error) {
        if (!record.cancelled) {
          const message = document.createElement('p');
          message.className = 'loom-error';
          message.setAttribute('role', 'alert');
          message.textContent = `图加载失败：${error instanceof Error ? error.message : String(error)}`;
          container.append(message);
          record.errorElement = message;
          container.dataset.diagramState = 'error';
          container.dispatchEvent(new CustomEvent('diagram:error', { detail: error }));
        }
        return { container, error };
      } finally { if (!record.instance) options.signal?.removeEventListener('abort', onAbort); }
    })();
    return record.promise;
  }));
}
/** Cancel pending initialization, release instances/errors, and allow a subsequent init. */
export function destroyDiagrams(root: ParentNode = document): void {
  for (const container of containers(root)) {
    const record = records.get(container);
    if (!record) continue;
    record.cancelled = true;
    record.controller.abort();
    record.instance?.destroy();
    record.errorElement?.remove();
    if (records.get(container) === record) records.delete(container);
    delete container.dataset.diagramState;
  }
}
