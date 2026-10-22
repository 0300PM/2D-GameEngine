import { Component, type SystemPhase } from "@engine";

export class Sparkle extends Component {
  phase: SystemPhase = "animation";
  private elapsed = 0;
  private readonly duration: number;

  constructor(duration = 1) {
    super();
    this.duration = Math.max(0.05, duration);
  }

  onUpdate(deltaTime: number): void {
    const owner = this.owner;
    if (!owner) return;
    this.elapsed += deltaTime;
    const progress = Math.min(1, this.elapsed / this.duration);
    owner.setScale(0.5 + progress * 2).setAlpha(1 - progress);
    if (progress >= 1) owner.destroy();
  }
}
