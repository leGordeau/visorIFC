# Local rendering frame with explicit CRS boundary

The renderer will use a local ENU/engineering frame while GIS and exports retain
the source world/CRS coordinates through a reversible transform. Reprojection is
owned by GIS and export adapters, not by the IFC or point-cloud domain objects.

## Consequences

Large coordinates do not directly reduce rendering precision, and IFC, cloud and
GIS sources can be aligned without mutating source data. Every workspace must
record the origin, CRS and transform provenance, and ambiguous CRS metadata must
require an explicit user decision.

