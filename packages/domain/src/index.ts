export type WorkspaceId = string & { readonly __brand: "WorkspaceId" };

export type CoordinateFrame = {
  crs?: string;
  origin: { x: number; y: number; z: number };
  unit: "metre";
};

export type CapabilityProfile = {
  webgpu: boolean;
  webgl: boolean;
  wasm: boolean;
  sharedArrayBuffer: boolean;
  persistentStorage: boolean;
};

export type SourceReference = {
  id: string;
  name: string;
  kind: "ifc" | "e57" | "las" | "laz" | "copc" | "unknown";
  location: "local" | "remote";
  sizeBytes?: number;
};

export type Workspace = {
  version: 1;
  id: string;
  name: string;
  sources: SourceReference[];
  coordinateFrame?: CoordinateFrame;
  capabilities?: CapabilityProfile;
};

export function createWorkspace(name = "Untitled workspace"): Workspace {
  return {
    version: 1,
    id: crypto.randomUUID(),
    name,
    sources: [],
  };
}
