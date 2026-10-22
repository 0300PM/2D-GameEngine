export type TaskHandle = {
  readonly id: number;
  readonly cancelled: boolean;
  cancel(): void;
};

export type TaskOptions = {
  owner?: string;
  repeat?: number;
  onError?: (error: unknown, taskId: number) => void;
};

type Task = {
  id: number;
  owner: string;
  remaining: number;
  interval: number;
  remainingRepeats: number;
  repeatable: boolean;
  callback: () => void;
  onError?: (error: unknown, taskId: number) => void;
  cancelled: boolean;
};

const MAX_CATCH_UP = 4;

const createHandle = (task: Task, cancel: (id: number) => void): TaskHandle => ({
  id: task.id,
  get cancelled(): boolean {
    return task.cancelled;
  },
  cancel: () => cancel(task.id)
});

export class Scheduler {
  private tasks = new Map<number, Task>();
  private nextId = 1;
  private reportedErrors = 0;

  delay(seconds: number, callback: () => void, options: TaskOptions = {}): TaskHandle {
    return this.schedule(seconds, callback, options, 1, false);
  }

  interval(seconds: number, callback: () => void, options: TaskOptions = {}): TaskHandle {
    return this.schedule(seconds, callback, options, options.repeat ?? Number.POSITIVE_INFINITY, true);
  }

  update(deltaTime: number): void {
    if (deltaTime <= 0 || this.tasks.size === 0) return;
    for (const task of this.tasks.values()) {
      if (task.cancelled) {
        this.tasks.delete(task.id);
        continue;
      }
      task.remaining -= deltaTime;
      let fired = 0;
      while (task.remaining <= 0 && !task.cancelled && fired < MAX_CATCH_UP) {
        this.invoke(task);
        fired += 1;
        if (task.cancelled) break;
        task.remainingRepeats -= 1;
        if (!task.repeatable || task.remainingRepeats <= 0) {
          this.cancelTask(task);
          break;
        }
        task.remaining += task.interval;
      }
      if (task.remaining < 0 && !task.cancelled) task.remaining = task.interval;
    }
  }

  cancel(handle: TaskHandle): void {
    this.cancelById(handle.id);
  }

  cancelOwner(owner: string): number {
    let removed = 0;
    for (const task of this.tasks.values()) {
      if (task.owner !== owner) continue;
      this.cancelTask(task);
      removed += 1;
    }
    return removed;
  }

  clear(): void {
    for (const task of this.tasks.values()) task.cancelled = true;
    this.tasks.clear();
  }

  has(id: number): boolean {
    const task = this.tasks.get(id);
    return Boolean(task && !task.cancelled);
  }

  count(owner?: string): number {
    if (!owner) return this.tasks.size;
    let total = 0;
    for (const task of this.tasks.values()) if (task.owner === owner) total += 1;
    return total;
  }

  get errorCount(): number {
    return this.reportedErrors;
  }

  private schedule(seconds: number, callback: () => void, options: TaskOptions, repeat: number, repeatable: boolean): TaskHandle {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error(`Timer interval must be a finite non-negative number, got ${seconds}`);
    const task: Task = {
      id: this.nextId++,
      owner: options.owner ?? "",
      remaining: seconds,
      interval: Math.max(seconds, 0.0001),
      remainingRepeats: repeat,
      repeatable,
      callback,
      onError: options.onError,
      cancelled: false
    };
    this.tasks.set(task.id, task);
    return createHandle(task, (id) => this.cancelById(id));
  }

  private invoke(task: Task): void {
    try {
      task.callback();
    } catch (error) {
      this.reportedErrors += 1;
      if (task.onError) task.onError(error, task.id);
    }
  }

  private cancelById(id: number): void {
    const task = this.tasks.get(id);
    if (!task) return;
    this.cancelTask(task);
  }

  private cancelTask(task: Task): void {
    task.cancelled = true;
    this.tasks.delete(task.id);
  }
}
