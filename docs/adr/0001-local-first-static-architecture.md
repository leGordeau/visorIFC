# Local-first static architecture

The viewer will process user-selected IFC and point-cloud files in the browser
and deploy as static assets on GitHub Pages. This trades server-side caching and
parallel native processing for privacy, offline-friendly operation and a much
smaller deployment contract; OPFS/IndexedDB stores only derived local state.

## Consequences

Large IFC files have a browser/WASM memory ceiling, so the product must stream,
cancel, cache and communicate limits. A future hosted processing service can be
added behind the existing application ports without changing the domain model.

