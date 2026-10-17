import { GeometryProcessor, type StreamingGeometryEvent } from "@ifc-lite/geometry";
import { IfcParser, type IfcDataStore } from "@ifc-lite/parser";
import { Renderer } from "@ifc-lite/renderer";
import initWasm from "@ifc-lite/wasm";
import wasmUrl from "@ifc-lite/wasm/ifc-lite_bg.wasm?url";
import { bindNavigation, type NavigationMode } from "./navigation";
export type { NavigationMode } from "./navigation";

let wasmInitialization: Promise<unknown> | undefined;

function initializeWasm(): Promise<unknown> {
  return wasmInitialization ??= initWasm({ module_or_path: wasmUrl }).catch((error) => {
    wasmInitialization = undefined;
    throw error;
  });
}

export const ifcEngineAdapter = { name: "ifclite" } as const;

export type IfcLoadProgress = {
  phase: string;
  percent: number;
  meshes: number;
};

export class IfcliteViewerAdapter {
  private readonly parser = new IfcParser();
  private renderer?: Renderer;
  private geometry?: GeometryProcessor;
  private animationFrame?: number;
  private geometryEstimate = 0;
  private disposed = false;
  private ready = false;
  private resizeObserver?: ResizeObserver;
  private unbindNavigation?: () => void;
  private navigationMode: NavigationMode = "orbit";

  setNavigationMode(mode: NavigationMode): void {
    this.navigationMode = mode;
  }

  zoom(delta: number): void {
    if (this.ready) this.renderer?.getCamera().zoom(delta, false);
  }

  async init(canvas: HTMLCanvasElement): Promise<void> {
    const renderer = new Renderer(canvas);
    this.renderer = renderer;
    await renderer.init();
    if (this.disposed) {
      renderer.destroy();
      return;
    }
    // Explicit asset URL avoids Vite's optimized dependency directory resolving
    // the binary to the SPA HTML fallback during development.
    await initializeWasm();
    if (this.disposed) return;
    this.geometry = new GeometryProcessor({
      tessellationQuality: "medium",
      skipSmallCuts: true,
    });
    await this.geometry.init();
    if (this.disposed) return;
    this.ready = true;
    this.resizeObserver = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width && rect.height) renderer.resize(rect.width, rect.height);
    });
    this.resizeObserver.observe(canvas);
    this.unbindNavigation = bindNavigation(
      canvas, renderer.getCamera(), () => this.navigationMode, () => this.fitToView(),
    );
    this.renderFrame();
  }

  async load(
    file: File,
    onProgress?: (progress: IfcLoadProgress) => void,
    signal?: AbortSignal,
  ): Promise<IfcDataStore> {
    if (!this.ready || !this.renderer || !this.geometry || this.disposed) {
      throw new Error("IFClite viewer is not initialized");
    }

    const buffer = await file.arrayBuffer();
    const store = await this.parser.parseColumnar(buffer, {
      onProgress: ({ phase, percent }) =>
        onProgress?.({ phase, percent, meshes: 0 }),
    });

    let meshes = 0;
    for await (const event of this.geometry.processAdaptive(
      new Uint8Array(buffer),
      { signal, wasmUrls: { wasm: wasmUrl } },
    )) {
      if (event.type === "batch") {
        meshes += event.meshes.length;
        this.renderer.addMeshes(event.meshes, true);
        const percent = this.geometryEstimate > 0
          ? Math.min(99, (event.totalSoFar / this.geometryEstimate) * 100)
          : 0;
        onProgress?.({ phase: "geometry", percent, meshes });
      } else {
        this.reportEvent(event, meshes, onProgress);
      }
    }

    if (!meshes) throw new Error("El IFC no contiene geometría representable");
    this.fitToView();
    onProgress?.({ phase: "complete", percent: 100, meshes });
    return store;
  }

  fitToView(): void {
    if (!this.ready || !this.renderer) return;
    this.renderer.fitToView();
    const bounds = this.renderer.getModelBounds();
    if (bounds) {
      const camera = this.renderer.getCamera();
      const radius = Math.hypot(
        bounds.max.x - bounds.min.x,
        bounds.max.y - bounds.min.y,
        bounds.max.z - bounds.min.z,
      ) / 2;
      const verticalHalfFov = camera.getFOV() / 2;
      const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * camera.getAspect());
      const distance = radius * 1.1 / Math.sin(Math.min(verticalHalfFov, horizontalHalfFov));
      const target = camera.getTarget();
      const position = camera.getPosition();
      const length = Math.hypot(position.x - target.x, position.y - target.y, position.z - target.z);
      if (length > 0 && Number.isFinite(distance) && distance > 0) {
        const scale = distance / length;
        camera.setPosition(
          target.x + (position.x - target.x) * scale,
          target.y + (position.y - target.y) * scale,
          target.z + (position.z - target.z) * scale,
        );
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    this.ready = false;
    this.resizeObserver?.disconnect();
    this.unbindNavigation?.();
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = undefined;
    }
    this.geometry?.dispose();
    this.renderer?.destroy();
    this.geometry = undefined;
    this.renderer = undefined;
  }

  private reportEvent(
    event: Exclude<StreamingGeometryEvent, { type: "batch" }>,
    meshes: number,
    onProgress?: (progress: IfcLoadProgress) => void,
  ): void {
    if (event.type === "start") {
      this.geometryEstimate = event.totalEstimate;
      onProgress?.({ phase: "geometry", percent: 0, meshes });
    }
  }

  private renderFrame = (): void => {
    this.renderer?.render();
    this.animationFrame = requestAnimationFrame(this.renderFrame);
  };
}
