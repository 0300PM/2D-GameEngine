if (typeof HTMLCanvasElement !== "undefined" && !(HTMLCanvasElement.prototype as unknown as { _mocked?: boolean })._mocked) {
  const orig = HTMLCanvasElement.prototype.getContext;
  (HTMLCanvasElement.prototype as unknown as { _mocked: boolean })._mocked = true;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string) {
    if (type === "2d") {
      return {
        fillStyle: "",
        fillRect: () => {},
        drawImage: () => {},
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
        putImageData: () => {},
        createImageData: () => ({ data: new Uint8ClampedArray(4) }),
        measureText: () => ({ width: 0 }),
        canvas: this as unknown as HTMLCanvasElement
      } as unknown as CanvasRenderingContext2D;
    }
    return orig ? (orig as unknown as (t: string) => unknown).call(this, type) as never : null;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
}
