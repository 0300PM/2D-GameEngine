import { Component, type SystemPhase } from "@engine";

export class Bobbing extends Component {
  phase: SystemPhase = "animation";
  private elapsed = 0;
  private baseY: number | null = null;
  private amplitude: number;
  private period: number;

  constructor(amplitude = 6, period = 700) {
    super();
    this.amplitude = amplitude;
    this.period = period;
  }

  onUpdate(deltaTime: number): void {
    const owner = this.owner;
    if (!owner) return;
    if (this.baseY === null) this.baseY = owner.y;
    this.elapsed = (this.elapsed + deltaTime * 1000) % this.period;
    owner.y = this.baseY + Math.sin((this.elapsed / this.period) * Math.PI * 2) * this.amplitude;
  }
}
