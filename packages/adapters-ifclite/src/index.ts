import { GeometryProcessor, type StreamingGeometryEvent } from "@ifc-lite/geometry";
import { IfcParser, type IfcDataStore } from "@ifc-lite/parser";
import { Renderer } from "@ifc-lite/renderer";

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

  async init(canvas: HTMLCanvasElement): Promise<void> {
    this.renderer = new Renderer(canvas);
    await this.renderer.init();
    this.geometry = new GeometryProcessor({
      tessellationQuality: "medium",
      skipSmallCuts: true,
    });
    await this.geometry.init();
    this.renderFrame();
  }

  async load(
    file: File,
    onProgress?: (progress: IfcLoadProgress) => void,
    signal?: AbortSignal,
  ): Promise<IfcDataStore> {
    if (!this.renderer || !this.geometry) {
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
      { signal },
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

    this.renderer.fitToView();
    onProgress?.({ phase: "complete", percent: 100, meshes });
    return store;
  }

  dispose(): void {
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
