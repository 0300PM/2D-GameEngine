import { Scene, type TextStyleData } from "@engine";

const style = (size: string, color: string, fontStyle?: string): TextStyleData => ({
  fontFamily: "monospace",
  fontSize: size,
  color,
  fontStyle
});

export class MenuScene extends Scene {
  private started = false;

  constructor() {
    super("menu");
  }

  create(): void {
    const { width, height } = this;
    this.getCamera().setBackgroundColor("#12151a");
    this.createRect(width, height, {
      x: width / 2,
      y: height / 2,
      color: 0x12151a,
      tags: ["ui"]
    });
    this.createText("BROWSER 2D ENGINE", {
      x: width / 2,
      y: height / 2 - 80,
      originX: 0.5,
      originY: 0.5,
      style: style("36px", "#7ee2a8", "bold"),
      tags: ["ui"]
    });
    this.createText("Top-Down Demo • MVP", {
      x: width / 2,
      y: height / 2 - 30,
      originX: 0.5,
      originY: 0.5,
      style: style("16px", "#a8afba"),
      tags: ["ui"]
    });
    this.createText("SPACE / E / klik", {
      x: width / 2,
      y: height / 2 + 40,
      originX: 0.5,
      originY: 0.5,
      style: style("13px", "#6b7280"),
      tags: ["ui"]
    });
  }

  update(): void {
    if (this.started) return;
    const input = this.getInput();
    if (input.isActionPressed("interact") || input.getPointer().isDown) this.start();
  }

  shutdown(): void {
    this.started = false;
  }

  private start(): void {
    this.started = true;
    this.getEvents().emit("request:scene", { to: "game" });
  }
}
