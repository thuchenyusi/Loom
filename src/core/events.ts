import type { DiagramEvents } from './types';

export class DiagramEventEmitter {
  private listeners: { [K in keyof DiagramEvents]: Set<(event: DiagramEvents[K]) => void> } = {
    change: new Set(), nodeclick: new Set(),
  };
  on<K extends keyof DiagramEvents>(event: K, listener: (event: DiagramEvents[K]) => void): () => void {
    this.listeners[event].add(listener);
    return () => { this.listeners[event].delete(listener); };
  }
  emit<K extends keyof DiagramEvents>(event: K, value: DiagramEvents[K]): void {
    for (const listener of this.listeners[event]) listener(value);
  }
  clear(): void { Object.values(this.listeners).forEach(listeners => listeners.clear()); }
}
