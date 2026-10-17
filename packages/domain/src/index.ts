export type WorkspaceId = string & { readonly __brand: "WorkspaceId" };

export type CoordinateFrame = {
  crs?: string;
  origin: { x: number; y: number; z: number };
  unit: "metre";
};

export type GisRegistration = {
  method: "manual-local-center";
  crs: "EPSG:4326";
  longitude: number;
  latitude: number;
  localOriginYUpMetres: { x: number; y: number; z: number };
  horizontalAxes: { easting: "x"; northing: "-z" };
};

/** Horizontal IFC bounds in IFClite render Y-up metres (plan uses X and Z). */
export type LocalPlanExtent = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  origin: { x: number; y: number; z: number };
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
  gisRegistration?: GisRegistration;
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
