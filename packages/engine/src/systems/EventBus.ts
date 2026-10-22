export type EventHandler<T = unknown> = (payload: T) => void;

type Subscription = {
  id: number;
  event: string;
  handler: EventHandler;
};

export type EventErrorHandler = (error: unknown, event: string) => void;

export class EventBus {
  onError: EventErrorHandler | null = null;
  private subscriptions = new Map<string, Set<Subscription>>();
  private nextId = 1;
  private sceneSubscriptions = new Map<string, Set<Subscription>>();

  on<T>(event: string, handler: EventHandler<T>): () => void {
    return this.subscribe(event, handler);
  }

  subscribe<T>(event: string, handler: EventHandler<T>): () => void {
    const sub: Subscription = { id: this.nextId++, event, handler: handler as EventHandler };
    if (!this.subscriptions.has(event)) this.subscriptions.set(event, new Set());
    this.subscriptions.get(event)!.add(sub);
    return () => this.offById(event, sub.id);
  }

  subscribeForScene<T>(sceneId: string, event: string, handler: EventHandler<T>): () => void {
    const sub: Subscription = { id: this.nextId++, event, handler: handler as EventHandler };
    if (!this.subscriptions.has(event)) this.subscriptions.set(event, new Set());
    this.subscriptions.get(event)!.add(sub);
    if (!this.sceneSubscriptions.has(sceneId)) this.sceneSubscriptions.set(sceneId, new Set());
    this.sceneSubscriptions.get(sceneId)!.add(sub);
    return () => {
      this.subscriptions.get(event)?.delete(sub);
      this.sceneSubscriptions.get(sceneId)?.delete(sub);
    };
  }

  off(event: string, handler: EventHandler): void {
    const set = this.subscriptions.get(event);
    if (!set) return;
    for (const sub of set) {
      if (sub.handler === handler) {
        set.delete(sub);
        break;
      }
    }
  }

  offById(event: string, id: number): void {
    const set = this.subscriptions.get(event);
    if (!set) return;
    for (const sub of set) {
      if (sub.id === id) {
        set.delete(sub);
        break;
      }
    }
  }

  emit<T>(event: string, payload: T): void {
    const set = this.subscriptions.get(event);
    if (!set) return;
    const handlers = Array.from(set);
    for (const sub of handlers) {
      try {
        sub.handler(payload);
      } catch (error) {
        this.onError?.(error, event);
      }
    }
  }

  clearScene(sceneId: string): void {
    const subs = this.sceneSubscriptions.get(sceneId);
    if (!subs) return;
    for (const sub of subs) {
      this.subscriptions.get(sub.event)?.delete(sub);
    }
    this.sceneSubscriptions.delete(sceneId);
  }

  clearAll(): void {
    this.subscriptions.clear();
    this.sceneSubscriptions.clear();
  }

  listenerCount(event: string): number {
    return this.subscriptions.get(event)?.size ?? 0;
  }
}
