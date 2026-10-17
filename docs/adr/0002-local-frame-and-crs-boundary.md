# Local rendering frame with explicit CRS boundary

The renderer will use a local ENU/engineering frame while GIS and exports retain
the source world/CRS coordinates through a reversible transform. Reprojection is
owned by GIS and export adapters, not by the IFC or point-cloud domain objects.

## Consequences

Large coordinates do not directly reduce rendering precision, and IFC, cloud and
GIS sources can be aligned without mutating source data. Every workspace must
record the origin, CRS and transform provenance, and ambiguous CRS metadata must
require an explicit user decision.

For the first GIS slice, the user explicitly registers the IFC's local plan
origin by clicking its known location on the map. IFClite's Y-up rendering frame
maps plan easting to +X and northing to -Z. This manual anchor is not an
authoritative IFC CRS and must remain labelled as such until a CRS-aware import
workflow is implemented. OpenStreetMap tiles are opt-in because enabling them
requests imagery for the visible area from that provider.

