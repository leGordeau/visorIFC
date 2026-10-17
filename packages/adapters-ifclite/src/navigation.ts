export type NavigationMode = "orbit" | "pan";

/** The input boundary only knows camera gestures, not IFC or GPU resources. */
export interface NavigationCamera {
  orbit(deltaX: number, deltaY: number): void;
  pan(deltaX: number, deltaY: number): void;
  zoom(delta: number, addVelocity?: boolean): void;
}

export function bindNavigation(
  canvas: HTMLCanvasElement,
  camera: NavigationCamera,
  getMode: () => NavigationMode,
  fitToView: () => void,
): () => void {
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  let drag: { id: number; x: number; y: number; pan: boolean } | undefined;

  function stopDrag() {
    const id = drag?.id;
    drag = undefined;
    delete canvas.dataset.dragging;
    if (id !== undefined && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (drag || event.button > 2) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId);
    drag = {
      id: event.pointerId, x: event.clientX, y: event.clientY,
      pan: getMode() === "pan" || event.button !== 0 || event.shiftKey,
    };
    canvas.dataset.dragging = "true";
  }, options);

  canvas.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    if (event.buttons === 0) { stopDrag(); return; }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (drag.pan || event.shiftKey) camera.pan(dx, dy);
    else camera.orbit(dx, dy);
  }, options);

  for (const type of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
    canvas.addEventListener(type, (event) => {
      if (event.pointerId === drag?.id) stopDrag();
    }, options);
  }
  canvas.addEventListener("blur", stopDrag, options);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault(), options);
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    // DOM_DELTA_LINE and DOM_DELTA_PAGE must not feel like pixel deltas.
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
    camera.zoom(Math.max(-240, Math.min(240, event.deltaY * unit)), false);
  }, { ...options, passive: false });

  canvas.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24],
    };
    const direction = arrows[event.key];
    if (direction) {
      event.preventDefault();
      if (getMode() === "pan" || event.shiftKey) camera.pan(...direction);
      else camera.orbit(...direction);
    } else if (["+", "=", "-", "_"].includes(event.key)) {
      event.preventDefault();
      camera.zoom(event.key === "-" || event.key === "_" ? 120 : -120, false);
    } else if (event.key === "Home" || event.key.toLowerCase() === "f") {
      event.preventDefault();
      fitToView();
    }
  }, options);

  return () => { stopDrag(); listeners.abort(); };
}
