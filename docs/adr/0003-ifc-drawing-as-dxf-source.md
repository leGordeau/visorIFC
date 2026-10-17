# IFC drawing geometry is the DXF source

DXF plans, sections and elevations will be generated from IFC geometry through
IFClite's 2D drawing pipeline. Point clouds may be projected as optional point
entities on a separate layer, but the viewer will not infer clean architectural
linework from raw point samples in the MVP.

## Consequences

DXF output is deterministic and semantically useful for BIM drawings while the
point-cloud workflow remains honest about its measurement data. Point-cloud
segmentation and reconstruction can be introduced later as a separate bounded
capability.
