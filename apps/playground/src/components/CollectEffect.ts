import { Component, type SystemPhase } from "@engine";

export class CollectEffect extends Component {
  phase: SystemPhase = "animation";
  private elapsed = 0;
  private duration: number;

  constructor(duration = 0.18) {
    super();
    this.duration = duration;
  }

  onUpdate(deltaTime: number): void {
    const owner = this.owner;
    if (!owner) return;
    this.elapsed += deltaTime;
    const progress = Math.min(1, this.elapsed / this.duration);
    owner.setScale(1 + progress * 0.6).setAlpha(1 - progress);
    if (progress >= 1) owner.destroy();
  }
}
