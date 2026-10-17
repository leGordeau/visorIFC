import { StrictMode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createWorkspace,
  type CapabilityProfile,
  type SourceReference,
  type Workspace,
} from "@ifc-viewer/domain";
import {
  detectCapabilities,
  downloadJson,
  sourceReferenceFromFile,
} from "@ifc-viewer/infrastructure-browser";
import { IfcliteViewerAdapter } from "@ifc-viewer/adapters-ifclite";
import "./styles.css";

function App() {
  const [workspace, setWorkspace] = useState<Workspace>(() =>
    createWorkspace(),
  );
  const [capabilities, setCapabilities] = useState<CapabilityProfile>();
  const [selectedSource, setSelectedSource] = useState<SourceReference>();
  const [status, setStatus] = useState("Ready for a local file");
  const ifcCanvasRef = useRef<HTMLCanvasElement>(null);
  const ifcViewerRef = useRef<IfcliteViewerAdapter | undefined>(undefined);

  useEffect(() => {
    void detectCapabilities().then((detected) => {
      setCapabilities(detected);
      setWorkspace((current) => ({ ...current, capabilities: detected }));
    });
  }, []);

  useEffect(() => {
    if (!capabilities?.webgpu || !ifcCanvasRef.current) return;
    const viewer = new IfcliteViewerAdapter();
    ifcViewerRef.current = viewer;
    void viewer.init(ifcCanvasRef.current).catch((error: unknown) => {
      setStatus(`IFClite no pudo inicializar WebGPU: ${String(error)}`);
      ifcViewerRef.current = undefined;
    });
    return () => {
      viewer.dispose();
      ifcViewerRef.current = undefined;
    };
  }, [capabilities?.webgpu]);

  const sourceSummary = useMemo(() => {
    if (!workspace.sources.length) return "No sources loaded";
    return `${workspace.sources.length} source${workspace.sources.length === 1 ? "" : "s"} in workspace`;
  }, [workspace.sources.length]);

  function onFileSelected(file?: File) {
    if (!file) return;
    const source = sourceReferenceFromFile(file);
    setSelectedSource(source);
    setWorkspace((current) => ({
      ...current,
      sources: [...current.sources, source],
    }));
    if (source.kind === "ifc" && ifcViewerRef.current) {
      setStatus(`Parsing ${file.name} with IFClite...`);
      void ifcViewerRef.current
        .load(file, (progress) => {
          const suffix = progress.meshes ? ` · ${progress.meshes} meshes` : "";
          setStatus(`${progress.phase} ${Math.round(progress.percent)}%${suffix}`);
        })
        .then(() => setStatus(`${file.name} loaded with IFClite`))
        .catch((error: unknown) => setStatus(`IFClite error: ${String(error)}`));
    } else {
      setStatus(`${file.name} staged for the IFC/point-cloud adapter`);
    }
  }

  function exportWorkspace() {
    downloadJson(`${workspace.name.replace(/\s+/g, "-").toLowerCase()}.pcv.json`, workspace);
    setStatus("Workspace manifest downloaded");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Open-source workspace</p>
          <h1>IFC GIS Point-Cloud Viewer</h1>
        </div>
        <div className="actions">
          <label className="button primary">
            Open local file
            <input
              type="file"
              accept=".ifc,.e57,.las,.laz,.copc,.copc.laz"
              onChange={(event) => onFileSelected(event.target.files?.[0])}
            />
          </label>
          <button className="button" type="button" onClick={exportWorkspace}>
            Save workspace
          </button>
        </div>
      </header>
      <section className="summary" aria-live="polite">
        <span>{status}</span>
        <span>{sourceSummary}</span>
      </section>
      <section className="workspace" aria-label="Viewer workspace">
        <div className="view-grid">
          <div className="viewport placeholder">
            {capabilities?.webgpu ? <canvas ref={ifcCanvasRef} /> : null}
            {!capabilities?.webgpu ? <strong>IFClite viewport</strong> : null}
            <span>{selectedSource?.name ?? "BIM scene adapter"}</span>
          </div>
          <div className="viewport placeholder compact">
            <strong>Cesium geospatial 3D</strong>
            <span>Terrain / 3D Tiles adapter</span>
          </div>
          <div className="viewport placeholder compact">
            <strong>OpenLayers GIS</strong>
            <span>2D map adapter</span>
          </div>
        </div>
        <aside className="panel">
          <h2>Workspace</h2>
          <p>Fase 1: shell, capacidades y manifiesto local.</p>
          <div className="capabilities">
            <Capability label="WebGPU" enabled={capabilities?.webgpu} />
            <Capability label="WebGL2" enabled={capabilities?.webgl} />
            <Capability label="WebAssembly" enabled={capabilities?.wasm} />
            <Capability
              label="SharedArrayBuffer"
              enabled={capabilities?.sharedArrayBuffer}
            />
          </div>
          <h3>Sources</h3>
          {workspace.sources.length ? (
            <ul className="source-list">
              {workspace.sources.map((source) => (
                <li key={source.id}>
                  <span>{source.name}</span>
                  <small>{source.kind.toUpperCase()}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Selecciona un IFC o una nube local.</p>
          )}
        </aside>
      </section>
    </main>
  );
}

function Capability({ label, enabled }: { label: string; enabled?: boolean }) {
  return (
    <div className="capability">
      <span className={enabled ? "dot on" : "dot"} />
      <span>{label}</span>
      <small>{enabled ? "ready" : "fallback"}</small>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
