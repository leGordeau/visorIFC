# IFC GIS Point-Cloud Viewer

Status: proposed specification after architecture grill

## 1. Summary

Build an open-source, frontend-only web application for GitHub Pages that
loads IFC models with IFClite, overlays georeferenced point clouds, provides
2D GIS capabilities, and exports IFC-derived sections, plans and elevations to
DXF. All source processing is local to the browser; no backend is required for
the MVP.

The application is a static Vite build. It uses WebGPU when available and
degrades explicitly to a WebGL or single-threaded path instead of failing
silently.

## 2. Goals

- Inspect IFC semantics, geometry, hierarchy and properties in the browser.
- Load local E57 and LAS/LAZ files and stream published COPC/LAZ datasets.
- Align IFC, clouds and GIS layers through explicit CRS and reversible
  local-frame transforms.
- Provide a linked 2D GIS map and 3D BIM/point-cloud scene.
- Provide an optional linked CesiumJS geospatial 3D view for globe, terrain and
  3D Tiles context.
- Generate vector plans, sections and elevations from IFC geometry.
- Export ASCII DXF R12 with layers, units and coordinate metadata.
- Remain deployable as static files on GitHub Pages.
- Keep the domain and application layers independent from IFClite, React and
  individual point-cloud renderers.
- Use SDD gates, measurable acceptance tests and reproducible fixtures.

## 3. Non-goals for the MVP

- Server-side processing, uploads, user accounts, collaboration or shared
  project storage.
- DWG export, DXF editing or full CAD authoring.
- Automatic architectural line reconstruction from point clouds.
- Advanced globe authoring, terrain editing or Cesium-specific analysis tools.
- Editing IFC source semantics or point-cloud samples.
- Guaranteed support for arbitrary multi-gigabyte IFC files in browser memory.
- PLY, XYZ and PCD import in the first release.

## 4. Product decisions

| Area | Decision | Rationale |
|---|---|---|
| Hosting | GitHub Pages static deployment | Fits the frontend-only constraint and keeps distribution simple. |
| Processing | Browser-local by default | Preserves privacy, supports offline use after the app is loaded, and avoids a backend contract. |
| Rendering | IFClite WebGPU renderer with capability detection and WebGL fallback adapter | WebGPU is the high-performance path; the fallback keeps parsing and basic viewing usable on more browsers. |
| IFC | IFClite parser/geometry/query packages behind an adapter | Uses the requested engine without coupling the domain to its API. |
| Point clouds | E57 + LAS/LAZ local; COPC/LAZ published | Covers scanner exchange and cloud-native spatial streaming without inventing a proprietary format. |
| GIS | OpenLayers 2D map plus CesiumJS 3D companion view | OpenLayers handles coordinate-aware 2D GIS; Cesium handles globe, terrain and 3D Tiles without replacing the BIM renderer. |
| Coordinates | Local ENU/engineering frame for rendering; declared CRS/world coordinates for GIS and export | Prevents large-coordinate precision loss while retaining reversible georeferencing. |
| Drawings | IFClite 2D drawing pipeline for IFC linework | Reuses a purpose-built section/plan/elevation implementation. |
| DXF | ASCII R12, metres by default, explicit layers and metadata | Maximises CAD interoperability and keeps the writer simple and deterministic. |
| Persistence | OPFS/IndexedDB cache plus `.pcv.json` manifest | Provides local resumability without pretending that GitHub Pages is a database. |
| License | Apache-2.0 for project code | Permissive reuse and commercial compatibility with contribution obligations. |

## 5. Researched options

### IFC engines

**IFClite** is the selected engine. Its Rust/WASM core supports IFC2X3,
IFC4/IFC4X3 and IFC5/IFCX, streams geometry and exposes browser, query and
2D-drawing packages. Its built-in renderer is WebGPU-oriented; Three.js or
Babylon.js integrations provide the WebGL fallback path.

**That Open / web-ifc** remains a viable alternative for a Three.js-first
implementation, especially where an existing component ecosystem is more
valuable than IFClite's columnar/exact-arithmetic pipeline.

**xeokit** is strong for preconverted XKT and mature BIM viewing, but its
viewer ecosystem and AGPL/commercial licensing model are a weaker fit for this
Apache-2.0, client-side, source-file-first product.

### Point clouds

**COPC/LAZ** is the preferred published-cloud contract because its octree
hierarchy supports spatial range reads. Potree is a proven WebGL point-cloud
renderer and remains an adapter candidate; a COPC-aware renderer or loader
should be selected through benchmarks rather than embedded in the domain.

**E57** is retained for local scanner-file import using a WASM reader with
chunked processing. It is an interchange format, not the preferred remote
streaming format.

**3D Tiles** is deferred. It is an excellent open standard for massive
geospatial datasets, but adding a second tile/scene ecosystem is not necessary
for the first linked 2D GIS experience.

### GIS

OpenLayers is selected for the 2D map and coordinate-aware vector workflow.
CesiumJS is selected as a companion geospatial 3D view for globe, terrain and
3D Tiles. MapLibre GL JS remains a future option for a lighter vector-tile map
shell, but it is not needed once Cesium owns the 3D geographic context.

### DXF

The primary exporter is the IFClite drawing-2d DXF path. A small MIT-licensed
JavaScript DXF writer is a fallback only if the IFClite exporter cannot meet a
required entity or layer contract.

## 6. Architecture

```text
                    +------------------------------+
                    | React UI / application shell  |
                    +---------------+--------------+
                                    |
                    +---------------v--------------+
                    | Application use cases         |
                    | load, align, inspect, cut,   |
                    | draw, export, persist         |
                    +---------------+--------------+
                                    |
                    +---------------v--------------+
                    | Domain model + ports           |
                    | no React, IFClite or WebGL     |
                    +--+------------+-----------+---+
                       |            |           |
          +------------v--+  +------v-----+ +---v----------------+
          | IFC adapter    |  | Cloud       | | GIS / DXF adapters |
          | IFClite WASM   |  | E57/COPC    | | OpenLayers/Cesium  |
          | parser/query   |  | LOD/worker  | | drawing/export     |
          +------------+---+  +------+-----+ +----------+---------+
                       |             |                  |
          +------------v-------------v------------------v---------+
          | Infrastructure: workers, WASM, OPFS/IndexedDB, files  |
          | capability detection, coordinate transforms, download  |
          +-------------------------------------------------------+
```

### Suggested workspace

```text
apps/
  viewer/
packages/
  domain/
  application/
  adapters-ifclite/
  adapters-pointcloud/
  adapters-gis-openlayers/
  adapters-gis-cesium/
  adapters-dxf/
  infrastructure-browser/
  ui/
  test-fixtures/
docs/
  spec/
  adr/
```

### Domain concepts

- `Workspace`: one local session and its manifest.
- `ModelReference`: source identity, schema, units, CRS and local transform.
- `PointCloudReference`: source type, bounds, attributes, CRS and loading
  strategy.
- `CoordinateFrame`: reversible local/world/CRS transforms.
- `SectionDefinition`: plane, optional depth/box, direction, elevation and
  projection settings.
- `LayerDefinition`: semantic drawing/GIS/point-cloud layer and visibility.
- `Drawing`: deterministic vector intermediate representation independent of
  DXF/SVG.
- `CapabilityProfile`: WebGPU, WebGL, WASM, SharedArrayBuffer, storage and
  memory capabilities.

### Ports

- `IfcEnginePort`: parse, query, stream geometry, select, section and create
  drawing primitives.
- `PointCloudPort`: inspect header, stream tiles/chunks, query bounds, expose
  attributes and project samples into a section.
- `MapPort`: create OpenLayers layers, transform coordinates, select features
  and sync the 2D map viewport with the workspace.
- `GeoScenePort`: create Cesium terrain, globe, primitive and 3D Tiles layers;
  synchronize camera, selection and coordinate frame without sharing a WebGL
  canvas with the IFClite renderer.
- `DrawingPort`: produce plans/sections/elevations from a `SectionDefinition`.
- `DxfWriterPort`: serialize the drawing IR with units, layers and coordinate
  metadata.
- `WorkspaceStorePort`: load/save manifests and cache entries.
- `FileSourcePort`: read local files or static URLs through a capability-safe
  abstraction.

## 7. Core flows

### Load IFC

1. Detect capabilities and select WebGPU/WebGL plus worker mode.
2. Read the local file without uploading it.
3. Parse metadata and georeferencing first.
4. Establish the local frame and store the reversible transform.
5. Stream geometry batches into the renderer.
6. Populate the spatial hierarchy, property inspector and model tree.
7. Persist a source fingerprint and derived-cache manifest.

### Load point cloud

1. Inspect file type, header, bounds, units, CRS and point attributes.
2. For E57/LAS/LAZ, process local files in cancellable chunks.
3. For COPC/LAZ, use HTTP range reads and request only visible hierarchy nodes.
4. Transform points to the shared local frame for rendering.
5. Apply an adaptive point budget based on frame time and memory ceiling.
6. Keep the source read-only; store only derived cache and display state.

### GIS alignment

1. Resolve model CRS from IFC metadata or explicit user override.
2. Resolve cloud CRS from its metadata or explicit user input.
3. Require an explicit transform when sources cannot be proven compatible.
4. Render BIM and clouds in the local frame.
5. Render GIS layers in their map projection and transform selection/measure
   results back to world/CRS coordinates.

If the Cesium view is enabled, the same world/CRS state is converted to
Earth-fixed coordinates and camera/selection synchronization remains explicit.

### Cesium geospatial view

Cesium is an optional companion scene, not a replacement for IFClite. Its first
release supports globe/terrain context, static imagery, GeoJSON/vector overlays
and published 3D Tiles. Local IFC and point-cloud data are represented there
only when a safe CRS-to-Earth transform is known; otherwise the UI keeps them in
the IFClite/OpenLayers views and explains the missing georeference.

The two 3D canvases must not share mutable renderer state. The application layer
owns camera intents, selection IDs, visibility and coordinate transforms; each
renderer adapter translates those intents into its own scene API.

### Drawing and DXF

1. Create a named horizontal plan, vertical section or elevation definition.
2. Use the IFC drawing pipeline to produce cut, projection and hidden geometry.
3. Optionally sample/project the point cloud into a `POINT_CLOUD` layer.
4. Generate a drawing IR with stable layer names and entity provenance.
5. Apply local or world/CRS coordinate transform selected by the user.
6. Serialize deterministic ASCII DXF R12 and download it locally.

## 8. DXF contract

Required layers:

- `IFC_CUT`: cut edges, bold semantic linework.
- `IFC_PROJECTION`: visible projected geometry.
- `IFC_HIDDEN`: hidden geometry, dashed where supported.
- `IFC_HATCH`: closed cut polygons/hatching.
- `POINT_CLOUD`: optional projected point entities.
- `ANNOTATIONS`: future dimensions and labels.

Every export must record units, source model identity, section definition,
coordinate frame and CRS in a leading DXF comment or sidecar metadata. Export
must be deterministic for the same workspace, source fingerprints and drawing
settings.

## 9. Browser and hosting behavior

- HTTPS is required in production; `localhost` is accepted for development.
- Detect WebGPU adapter availability, not only the presence of
  `navigator.gpu`.
- Detect `crossOriginIsolated` and `SharedArrayBuffer` independently.
- GitHub Pages is supported without custom headers. The default path must work
  with single-threaded or copied buffers.
- An optional COOP/COEP Service Worker may be offered as an explicit performance
  mode, with a first-load/reload explanation and safe fallback.
- Cross-origin assets must be same-origin, CORS-enabled, or omitted from the
  isolated mode to avoid COEP failures.
- Browser storage quotas and permission errors must be visible and recoverable.

## 10. Performance and reliability

Reference envelope:

- IFC up to 250 MB for validation fixtures.
- E57 up to 2 GB for chunked local processing.
- Published COPC/LAZ streamed without a total-size limit in the viewer.
- 30 FPS target; below 24 FPS, reduce point/geometry budgets and show status.
- No full-cloud materialization in the renderer's resident memory.
- Cancellation at file, chunk, tile and drawing-export boundaries.
- Errors must identify source, phase, recoverability and suggested action.

Benchmarks must record: time to first geometry, full parse time, peak JS/WASM
memory, resident points, frame-time percentiles for IFClite and Cesium,
OpenLayers/Cesium synchronization latency, section generation time and DXF
export time.

## 11. Security and privacy

- Never upload local files by default.
- Treat IFC properties, filenames, URLs and embedded metadata as untrusted data.
- Do not execute model-provided scripts or HTML.
- Sanitize text in the property inspector and drawing annotations.
- Restrict remote fetches to user-selected URLs and document CORS behavior.
- Pin package versions and emit a third-party license inventory.

## 12. SDD delivery plan

### Gate 0 — Context and specification

Keep `CONTEXT.md` limited to project-specific language. Review this spec and
record any hard-to-reverse decisions as short ADRs before implementation.

### Gate 1 — Vertical slice

Load a small IFC, establish a local frame, render it, create one horizontal
section, export a valid DXF and show it beside an OpenLayers map.

### Gate 2 — Point-cloud slice

Load a small E57 and COPC fixture, align each with the IFC, render a bounded
region and export projected point samples.

### Gate 3 — Browser resilience

Run the same flows in WebGPU/multiprocess, WebGPU/single-threaded and WebGL
fallback profiles; verify GitHub Pages deployment and optional Service Worker.

### Gate 4 — Production hardening

Add adaptive LOD, cache invalidation, cancellation, error recovery, license
checks, bundle budgets, accessibility and cross-browser E2E tests.

Each implementation ticket must link to a requirement and an acceptance test;
each adapter must have contract tests against the domain ports.

## 13. Acceptance criteria for the MVP

- A user can drag or select an IFC and view geometry and properties without a
  server upload.
- A user can load E57 and LAS/LAZ locally with progress and cancellation.
- A user can open a published COPC/LAZ URL and see only visible hierarchy
  ranges requested as the camera moves.
- IFC and cloud coordinates can be aligned through a declared transform and
  displayed on the 2D map.
- A user can create, save and reopen a named plan or section in the workspace.
- A user can export IFC-derived linework to DXF R12 with the required layers,
  units and coordinate metadata.
- A user can enable Cesium and inspect georeferenced terrain, imagery or 3D
  Tiles while keeping selection and coordinate state synchronized with the
  BIM/GIS workspace.
- The same app communicates capability limits and degrades without data loss
  when WebGPU, SharedArrayBuffer or persistent storage is unavailable.
- CI passes typecheck, lint, unit, adapter contract, E2E, build, bundle-budget
  and license-inventory checks.

## 14. Further notes and ADRs

- [ADR-0001: Local-first static architecture](../adr/0001-local-first-static-architecture.md)
- [ADR-0002: Local rendering frame with explicit CRS boundary](../adr/0002-local-frame-and-crs-boundary.md)
- [ADR-0003: IFC drawing geometry is the DXF source](../adr/0003-ifc-drawing-as-dxf-source.md)
- [ADR-0004: Cesium as a companion geospatial scene](../adr/0004-cesium-as-companion-geospatial-scene.md)

## 15. Sources and further reading

- [IFClite repository](https://github.com/LTplus-AG/ifc-lite)
- [IFClite browser requirements](https://github.com/LTplus-AG/ifc-lite/blob/main/docs/guide/browser-requirements.md)
- [IFClite performance guide](https://github.com/LTplus-AG/ifc-lite/blob/main/docs/guide/performance.md)
- [IFClite 2D drawings and DXF](https://github.com/LTplus-AG/ifc-lite/blob/main/docs/guide/drawing-2d.md)
- [OpenLayers API](https://openlayers.org/en/latest/apidoc/)
- [COPC specification](https://copc.io/copc-specification-1.0.pdf)
- [Potree](https://github.com/potree/potree)
- [e57-js](https://github.com/semehdi/e57-js)
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)
- [Cesium 3D Tiles](https://cesium.com/why-cesium/3d-tiles/)
- [CesiumJS repository and license](https://github.com/CesiumGS/cesium)
- [GitHub Pages COOP/COEP discussion](https://github.com/orgs/community/discussions/13309)

