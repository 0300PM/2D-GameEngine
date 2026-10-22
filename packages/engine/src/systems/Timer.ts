import type { Scheduler, TaskHandle } from "./Scheduler";

export type TimerOptions = {
  onError?: (error: unknown, taskId: number) => void;
};

export class Timer {
  constructor(
    private scheduler: Scheduler,
    private owner: string
  ) {}

  delay(seconds: number, callback: () => void, options: TimerOptions = {}): TaskHandle {
    return this.scheduler.delay(seconds, callback, { owner: this.owner, onError: options.onError });
  }

  interval(seconds: number, callback: () => void, options: TimerOptions & { repeat?: number } = {}): TaskHandle {
    return this.scheduler.interval(seconds, callback, { owner: this.owner, repeat: options.repeat, onError: options.onError });
  }

  cancel(handle: TaskHandle): void {
    this.scheduler.cancel(handle);
  }

  clear(): number {
    return this.scheduler.cancelOwner(this.owner);
  }

  get pending(): number {
    return this.scheduler.count(this.owner);
  }
}
