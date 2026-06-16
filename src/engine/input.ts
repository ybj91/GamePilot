/**
 * Input state shared across the engine. Tracks the pointer (world coords), held
 * keys (for `arrows` control), and edge-triggered presses this frame (for
 * `on:"input"` rules — fire once per key-down, not while held). Decoupling
 * capture from the loop keeps the engine testable: rules read a plain `InputEnv`
 * you can synthesize in a headless test.
 */

/** The slice of input that rule evaluation reads each step. */
export interface InputEnv {
  /** Keys pressed (down-edge) since the last engine step. */
  pressed: ReadonlySet<string>;
  pointerX: number;
  pointerY: number;
  pointerActive: boolean;
}

/** Map raw DOM key names to the friendly tokens the DSL uses. */
export function normalizeKey(key: string): string {
  if (key === " ") return "space";
  if (key.startsWith("Arrow")) return key.slice(5).toLowerCase(); // up/down/left/right
  return key.toLowerCase();
}

export class Input {
  pointerX = 0;
  pointerY = 0;
  pointerActive = false;
  private keys = new Set<string>();
  private justPressed = new Set<string>();

  /** Axis value in [-1, 1] from arrow keys / WASD. */
  get axisX(): number {
    return (
      (this.keys.has("right") || this.keys.has("d") ? 1 : 0) -
      (this.keys.has("left") || this.keys.has("a") ? 1 : 0)
    );
  }

  get axisY(): number {
    return (
      (this.keys.has("down") || this.keys.has("s") ? 1 : 0) -
      (this.keys.has("up") || this.keys.has("w") ? 1 : 0)
    );
  }

  /** Snapshot for rule evaluation this step. */
  frameEnv(): InputEnv {
    return {
      pressed: this.justPressed,
      pointerX: this.pointerX,
      pointerY: this.pointerY,
      pointerActive: this.pointerActive,
    };
  }

  /** Clear per-frame edges after a step has consumed them. */
  endFrame(): void {
    this.justPressed.clear();
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
    const onDown = (ev: PointerEvent) => {
      toWorld(ev.clientX, ev.clientY);
      this.pointerActive = true;
      this.justPressed.add("pointer");
    };
    const onLeave = () => (this.pointerActive = false);
    const onKeyDown = (ev: KeyboardEvent) => {
      const k = normalizeKey(ev.key);
      if (!this.keys.has(k)) this.justPressed.add(k); // down-edge only
      this.keys.add(k);
    };
    const onKeyUp = (ev: KeyboardEvent) => this.keys.delete(normalizeKey(ev.key));

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerleave", onLeave);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }
}
