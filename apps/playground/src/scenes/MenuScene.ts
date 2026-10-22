import { Scene, type TextStyleData } from "@engine";
import { t } from "../i18n";

const label = (size: string, color: string, extra: TextStyleData = {}): TextStyleData => ({
  fontFamily: "monospace",
  fontSize: size,
  color,
  ...extra
});

export class MenuScene extends Scene {
  private started = false;

  constructor() {
    super("menu");
  }

  create(): void {
    const { width, height } = this;
    this.getCamera().setBackgroundColor("#0b0c0e");

    this.createRect(width, height, {
      id: "backdrop",
      x: width / 2,
      y: height / 2,
      color: 0x0b0c0e,
      fillAlpha: 0,
      tags: ["ui"]
    });

    this.createText(t("SILNIK 2D NAD PHASEREM", "A 2D ENGINE ON PHASER"), {
      x: width / 2,
      y: height / 2 - 96,
      originX: 0.5,
      originY: 0.5,
      style: label("12px", "#6b7280"),
      tags: ["ui"]
    });

    this.createText("BROWSER 2D ENGINE", {
      x: width / 2,
      y: height / 2 - 56,
      originX: 0.5,
      originY: 0.5,
      style: label("34px", "#f2f3f5", { fontStyle: "bold" }),
      tags: ["ui"]
    });

    this.createText("Top-Down Demo · MVP 0.2", {
      x: width / 2,
      y: height / 2 - 16,
      originX: 0.5,
      originY: 0.5,
      style: label("13px", "#a8afba"),
      tags: ["ui"]
    });

    this.createRect(236, 46, {
      x: width / 2,
      y: height / 2 + 56,
      color: 0x15171a,
      fillAlpha: 0,
      tags: ["ui"]
    });

    this.createText(t("ROZPOCZNIJ  [SPACE]", "START  [SPACE]"), {
      id: "menu-cta",
      x: width / 2,
      y: height / 2 + 56,
      originX: 0.5,
      originY: 0.5,
      style: label("13px", "#f2f3f5"),
      tags: ["ui"]
    });

    this.createText(t("SPACE • E • kliknięcie", "SPACE • E • click"), {
      x: width / 2,
      y: height / 2 + 112,
      originX: 0.5,
      originY: 0.5,
      style: label("12px", "#6b7280"),
      tags: ["ui"]
    });
  }

  update(): void {
    if (this.started) return;
    const input = this.getInput();
    if (input.isActionPressed("interact") || input.isActionPressed("jump") || input.getPointer().isDown) this.startGame();
  }

  shutdown(): void {
    this.started = false;
  }

  private startGame(): void {
    if (this.started) return;
    this.started = true;
    this.getEvents().emit("request:scene", { to: "game" });
  }
}
