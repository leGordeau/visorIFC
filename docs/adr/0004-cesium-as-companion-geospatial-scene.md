# Cesium as a companion geospatial scene

CesiumJS will provide the viewer's globe, terrain and 3D-Tiles context while
IFClite remains the authoritative BIM renderer and OpenLayers remains the 2D GIS
map. The scenes will use separate canvases and renderer state, coordinated by
application-level camera intents, selections and reversible coordinate frames.

## Consequences

The product can scale to geospatial context and 3D Tiles without forcing IFC
geometry into Cesium's rendering model. It must maintain explicit synchronization
contracts and test WebGPU IFClite alongside WebGL Cesium on the reference
hardware.
