# IFC GIS Viewer Context

Glossary for the browser-based IFC, GIS and point-cloud viewer. It keeps the
project's domain language precise across the specification, code and future
implementation sessions.

## Models and datasets

**IFC model**:
A BIM dataset in Industry Foundation Classes format containing building,
infrastructure or facility entities and their relationships. _Avoid_: BIM file
when the semantic IFC dataset is meant.

**Published cloud**:
A point-cloud dataset prepared for spatial streaming from static hosting,
normally as COPC/LAZ. _Avoid_: uploaded cloud, which implies a server-side
ingestion step that this product does not require.

**Workspace**:
A local viewer session containing model references, dataset references,
coordinate transforms, visibility state, layers and drawing settings. It is
described by a portable manifest but does not embed large source files.

## Spatial language

**Local frame**:
The numerically stable engineering coordinate system used by the renderer near
the selected origin. It is reversible to the model's world or CRS coordinates.

**World/CRS coordinates**:
Coordinates in the source model's declared or user-selected coordinate
reference system, used for GIS alignment and optional georeferenced exports.

**Drawing**:
A vector 2D representation generated from a defined cut and projection of the
IFC model, optionally augmented with projected point-cloud points.

**Geospatial 3D view**:
The CesiumJS globe, terrain and 3D-Tiles view used for large-scale geographic
context. It is coordinated with, but is not the IFC renderer.

## Flagged ambiguities

- “Importar una nube” means local file import for E57/LAS/LAZ, while a
  **published cloud** is streamed from a static URL. They share a viewer
  adapter but not the same loading strategy.
- “Plano” means a horizontal IFC drawing cut, not a raster screenshot or an
  inferred architectural reconstruction from point-cloud samples.
