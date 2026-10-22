import { Component, type SystemPhase } from "@engine";

export class PlayerController extends Component {
  phase: SystemPhase = "physics";
  private speed: number;

  constructor(speed = 220) {
    super();
    this.speed = speed;
  }

  onUpdate(): void {
    const scene = this.scene;
    const owner = this.owner;
    if (!scene || !owner) return;
    const input = scene.getInput();
    let vx = 0;
    let vy = 0;
    if (input.isActionDown("move-left")) vx -= 1;
    if (input.isActionDown("move-right")) vx += 1;
    if (input.isActionDown("move-up")) vy -= 1;
    if (input.isActionDown("move-down")) vy += 1;
    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }
    scene.getPhysics().setVelocity(owner, vx * this.speed, vy * this.speed);
  }
}
