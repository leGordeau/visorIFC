import type { CapabilityProfile, SourceReference } from "@ifc-viewer/domain";

export const browserInfrastructure = { name: "browser" } as const;

export async function detectCapabilities(): Promise<CapabilityProfile> {
  const webgpuApi = (
    navigator as Navigator & {
      gpu?: { requestAdapter(): Promise<unknown> };
    }
  ).gpu;
  const webgpu = Boolean(webgpuApi && (await webgpuApi.requestAdapter()));

  return {
    webgpu,
    webgl: Boolean(document.createElement("canvas").getContext("webgl2")),
    wasm: typeof WebAssembly !== "undefined",
    sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    persistentStorage: Boolean(navigator.storage?.persist),
  };
}

export function sourceReferenceFromFile(file: File): SourceReference {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const kind =
    extension === "ifc"
      ? "ifc"
      : extension === "e57"
        ? "e57"
        : extension === "las"
          ? "las"
          : extension === "laz"
            ? "laz"
            : "unknown";

  return {
    id: crypto.randomUUID(),
    name: file.name,
    kind,
    location: "local",
    sizeBytes: file.size,
  };
}

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
