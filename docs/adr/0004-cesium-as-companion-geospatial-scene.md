# Cesium as a companion geospatial scene

CesiumJS will provide the viewer's globe, terrain and 3D-Tiles context while
IFClite remains the authoritative BIM renderer and OpenLayers remains the 2D GIS
map. The application presents one viewport with selectable scene modes and
layer visibility controls. Each engine retains its own canvas and renderer
state; application-level camera intents, selections and reversible coordinate
frames coordinate the scene transitions.

## Consequences

The product can scale to geospatial context and 3D Tiles without forcing IFC
geometry into Cesium's rendering model, while avoiding competing viewports in
the main workflow. It must maintain explicit synchronization contracts and
test WebGPU IFClite alongside WebGL Cesium on the reference hardware.
