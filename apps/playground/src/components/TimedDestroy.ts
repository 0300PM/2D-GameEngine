import { Component } from "@engine";

export class TimedDestroy extends Component {
  private remaining: number;

  constructor(seconds = 1) {
    super();
    this.remaining = seconds;
  }

  onUpdate(deltaTime: number): void {
    this.remaining -= deltaTime;
    if (this.remaining <= 0) this.owner?.destroy();
  }
}
