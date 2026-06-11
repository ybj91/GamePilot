/**
 * Input state shared across the engine. A single Input instance tracks the
 * pointer position (in world coordinates) and held keys; control logic in
 * movement.ts reads from it. Decoupling input capture from the loop keeps the
 * engine testable (you can feed a synthetic Input).
 */

export class Input {
  pointerX = 0;
  pointerY = 0;
  pointerActive = false;
  private keys = new Set<string>();

  /** Axis value in [-1, 1] from arrow keys / WASD. */
  get axisX(): number {
    return (
      (this.keys.has("ArrowRight") || this.keys.has("d") ? 1 : 0) -
      (this.keys.has("ArrowLeft") || this.keys.has("a") ? 1 : 0)
    );
  }

  get axisY(): number {
    return (
      (this.keys.has("ArrowDown") || this.keys.has("s") ? 1 : 0) -
      (this.keys.has("ArrowUp") || this.keys.has("w") ? 1 : 0)
    );
  }

  /** Wire DOM events from a canvas. Returns a disposer. */
  attach(canvas: HTMLCanvasElement): () => void {
    const toWorld = (clientX: number, clientY: number) => {
      const r = canvas.getBoundingClientRect();
      this.pointerX = ((clientX - r.left) / r.width) * canvas.width;
      this.pointerY = ((clientY - r.top) / r.height) * canvas.height;
    };
    const onMove = (ev: PointerEvent) => {
      toWorld(ev.clientX, ev.clientY);
      this.pointerActive = true;
    };
    const onLeave = () => (this.pointerActive = false);
    const onKeyDown = (ev: KeyboardEvent) => this.keys.add(ev.key);
    const onKeyUp = (ev: KeyboardEvent) => this.keys.delete(ev.key);

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }
}
