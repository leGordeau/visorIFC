import { StrictMode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createWorkspace,
  type CapabilityProfile,
  type GisRegistration,
  type LocalPlanExtent,
  type SourceReference,
  type Workspace,
} from "@ifc-viewer/domain";
import {
  detectCapabilities,
  downloadJson,
  sourceReferenceFromFile,
} from "@ifc-viewer/infrastructure-browser";
import { IfcliteViewerAdapter, type NavigationMode } from "@ifc-viewer/adapters-ifclite";
import { OpenLayersGisAdapter, type GisCursorPosition } from "@ifc-viewer/adapters-gis-openlayers";
import "./styles.css";

function App() {
  const [workspace, setWorkspace] = useState<Workspace>(() =>
    createWorkspace(),
  );
  const [capabilities, setCapabilities] = useState<CapabilityProfile>();
  const [selectedSource, setSelectedSource] = useState<SourceReference>();
  const [status, setStatus] = useState("Ready for a local file");
  const [viewerReady, setViewerReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [navigationMode, setNavigationMode] = useState<NavigationMode>("orbit");
  const [activeView, setActiveView] = useState<"ifc" | "gis" | "cesium">("ifc");
  const [ifcVisible, setIfcVisible] = useState(true);
  const [gisVisible, setGisVisible] = useState(false);
  const [cesiumVisible, setCesiumVisible] = useState(false);
  const [osmEnabled, setOsmEnabled] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<GisCursorPosition>();
  const [gisRegistration, setGisRegistration] = useState<GisRegistration>();
  const [ifcExtent, setIfcExtent] = useState<LocalPlanExtent>();
  const ifcCanvasRef = useRef<HTMLCanvasElement>(null);
  const gisTargetRef = useRef<HTMLDivElement>(null);
  const ifcViewerRef = useRef<IfcliteViewerAdapter | undefined>(undefined);
  const gisViewerRef = useRef<OpenLayersGisAdapter | undefined>(undefined);

  useEffect(() => {
    if (!gisTargetRef.current) return;
    const map = new OpenLayersGisAdapter(
      gisTargetRef.current,
      (registration) => {
        setGisRegistration(registration);
        setWorkspace((current) => ({ ...current, gisRegistration: registration }));
      },
      setCursorPosition,
    );
    gisViewerRef.current = map;
    return () => {
      map.dispose();
      gisViewerRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    gisViewerRef.current?.setFootprint(ifcExtent);
  }, [ifcExtent]);

  useEffect(() => {
    gisViewerRef.current?.setIfcVisible(ifcVisible);
  }, [ifcVisible]);

  useEffect(() => {
    gisViewerRef.current?.setVisible(activeView === "gis");
  }, [activeView]);

  useEffect(() => {
    gisViewerRef.current?.setBaseMapEnabled(osmEnabled);
  }, [osmEnabled]);

  useEffect(() => {
    void detectCapabilities().then((detected) => {
      setCapabilities(detected);
      setWorkspace((current) => ({ ...current, capabilities: detected }));
    });
  }, []);

  useEffect(() => {
    if (!capabilities?.webgpu || !ifcCanvasRef.current) return;
    const viewer = new IfcliteViewerAdapter();
    let active = true;
    setViewerReady(false);
    setStatus("Inicializando visor 3D…");
    void viewer.init(ifcCanvasRef.current)
      .then(() => {
        if (!active) return;
        ifcViewerRef.current = viewer;
        setViewerReady(true);
        setStatus("Visor 3D listo. Selecciona un IFC local.");
      })
      .catch((error: unknown) => {
        if (!active) return;
        viewer.dispose();
        setStatus(`Error al inicializar IFClite: ${String(error)}`);
      });
    return () => {
      active = false;
      viewer.dispose();
      ifcViewerRef.current = undefined;
    };
  }, [capabilities?.webgpu]);

  useEffect(() => {
    ifcViewerRef.current?.setNavigationMode(navigationMode);
  }, [navigationMode, viewerReady]);

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
      setLoading(true);
      setStatus(`Parsing ${file.name} with IFClite...`);
      void ifcViewerRef.current
        .load(file, (progress) => {
          const suffix = progress.meshes ? ` · ${progress.meshes} meshes` : "";
          setStatus(`${progress.phase} ${Math.round(progress.percent)}%${suffix}`);
        })
        .then(() => {
          const extent = ifcViewerRef.current?.getPlanExtent();
          setIfcExtent(extent);
          if (extent && gisRegistration) {
            const registration = {
              ...gisRegistration,
              localOriginYUpMetres: extent.origin,
            };
            setGisRegistration(registration);
            setWorkspace((current) => ({ ...current, gisRegistration: registration }));
          }
          setStatus(`${file.name} loaded with IFClite`);
        })
        .catch((error: unknown) => setStatus(`IFClite error: ${String(error)}`))
        .finally(() => setLoading(false));
    } else {
      setStatus(source.kind === "ifc"
        ? "El visor 3D no está listo. Revisa el error de inicialización."
        : `${file.name}: importación de nubes de puntos pendiente de implementar`);
    }
  }

  function exportWorkspace() {
    downloadJson(`${workspace.name.replace(/\s+/g, "-").toLowerCase()}.pcv.json`, workspace);
    setStatus("Workspace manifest downloaded");
  }

  function toggleIfcLayer(visible: boolean) {
    setIfcVisible(visible);
    if (visible) setActiveView("ifc");
    else if (activeView === "ifc") setActiveView(gisVisible ? "gis" : cesiumVisible ? "cesium" : "ifc");
  }

  function toggleGisLayer(visible: boolean) {
    setGisVisible(visible);
    if (visible) setActiveView("gis");
    else if (activeView === "gis") setActiveView(ifcVisible ? "ifc" : cesiumVisible ? "cesium" : "gis");
  }

  function toggleCesiumLayer(visible: boolean) {
    setCesiumVisible(visible);
    if (visible) setActiveView("cesium");
    else if (activeView === "cesium") setActiveView(ifcVisible ? "ifc" : gisVisible ? "gis" : "cesium");
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
              aria-label="Open local file"
              disabled={!viewerReady || loading}
              accept=".ifc,.e57,.las,.laz,.copc,.copc.laz"
              onChange={(event) => {
                onFileSelected(event.target.files?.[0]);
                event.target.value = "";
              }}
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
      <section className="workspace unified-workspace" aria-label="Viewer workspace">
        <div className="single-viewer">
          <div className="viewport bim-viewport" data-view={activeView}>
            <div className="scene-tabs" role="tablist" aria-label="Vista de la escena">
              <button className="button" role="tab" aria-selected={activeView === "ifc"} disabled={!ifcVisible} onClick={() => setActiveView("ifc")}>IFC 3D</button>
              <button className="button" role="tab" aria-selected={activeView === "gis"} disabled={!gisVisible} onClick={() => setActiveView("gis")}>GIS 2D</button>
              <button className="button" role="tab" aria-selected={activeView === "cesium"} onClick={() => setActiveView("cesium")}
                disabled={!cesiumVisible} title="Activa la capa Cesium para abrir su vista">Cesium 3D</button>
            </div>
            <div className="scene-canvas" hidden={activeView !== "ifc" || !ifcVisible}>
              {capabilities?.webgpu ? <canvas
                ref={ifcCanvasRef} tabIndex={0} aria-label="Visor 3D del modelo IFC"
                aria-describedby="navigation-help" data-navigation={navigationMode}
              /> : <strong>IFClite requiere WebGPU en este navegador</strong>}
              <span>{selectedSource?.name ?? "Sin IFC cargado"}</span>
            </div>
            <div className="scene-canvas gis-canvas" ref={gisTargetRef} hidden={activeView !== "gis"} aria-label="Mapa GIS">
              {gisVisible && !gisRegistration ? <div className="map-hint">Haz clic en el mapa para situar el centro del IFC.</div> : null}
              {gisRegistration ? <div className="map-hint">Origen registrado · EPSG:4326 · {gisRegistration.longitude.toFixed(5)}, {gisRegistration.latitude.toFixed(5)}</div> : null}
              {cursorPosition ? <div className="coordinate-readout">{cursorPosition.latitude.toFixed(6)}°, {cursorPosition.longitude.toFixed(6)}°</div> : null}
            </div>
            <div className="scene-canvas cesium-placeholder" hidden={activeView !== "cesium"}>
              <strong>Cesium 3D</strong>
              <span>La capa está preparada en el panel; la integración del globo llegará en la siguiente fase.</span>
            </div>
            {!ifcVisible && !gisVisible && !cesiumVisible ? <div className="scene-canvas cesium-placeholder"><strong>Sin capas activas</strong><span>Activa IFC, GIS o Cesium en el panel para mostrar una escena.</span></div> : null}
            {activeView === "ifc" && ifcVisible ? <div className="navigation-toolbar" role="toolbar" aria-label="Navegación 3D">
              <button className="button" disabled={!viewerReady} aria-pressed={navigationMode === "orbit"}
                onClick={() => setNavigationMode("orbit")}>Rotar</button>
              <button className="button" disabled={!viewerReady} aria-pressed={navigationMode === "pan"}
                onClick={() => setNavigationMode("pan")}>Panear</button>
              <button className="button" disabled={!viewerReady} aria-label="Acercar modelo"
                onClick={() => ifcViewerRef.current?.zoom(-120)}>+</button>
              <button className="button" disabled={!viewerReady} aria-label="Alejar modelo"
                onClick={() => ifcViewerRef.current?.zoom(120)}>−</button>
              <button className="button" disabled={!viewerReady || loading}
                onClick={() => ifcViewerRef.current?.fitToView()}>Encuadrar</button>
            </div> : null}
            {activeView === "gis" ? <div className="map-toolbar">
              <button className="button" disabled={!gisRegistration || !ifcExtent}
                onClick={() => gisViewerRef.current?.fitModel()}>Encuadrar huella IFC</button>
              <label className="map-base-toggle" title="Al activarlo, OpenStreetMap recibe peticiones de teselas para la zona visible.">
                <input type="checkbox" checked={osmEnabled} onChange={(event) => setOsmEnabled(event.target.checked)} />
                Fondo OpenStreetMap
              </label>
            </div> : null}
          </div>
        </div>
        <aside className="panel layer-panel">
          <h2>Capas</h2>
          <p>{activeView === "ifc" ? "Escena de modelo" : activeView === "gis" ? "Escena geográfica" : "Escena Cesium"}</p>
          <label className="layer-toggle"><input type="checkbox" checked={ifcVisible} onChange={(event) => toggleIfcLayer(event.target.checked)} /> IFC · modelo y huella</label>
          <label className="layer-toggle"><input type="checkbox" checked={gisVisible} onChange={(event) => toggleGisLayer(event.target.checked)} /> GIS · mapa y registro</label>
          <label className="layer-toggle"><input type="checkbox" checked={cesiumVisible} onChange={(event) => toggleCesiumLayer(event.target.checked)} /> Cesium · globo 3D</label>
          <p className="muted">Activa una o varias capas; el selector superior elige cuál ocupa esta única ventana gráfica.</p>
          <h2>Workspace</h2>
          <p>{viewerReady ? "Visor IFC listo" : "Inicializando visor IFC"}{loading ? " · Cargando modelo…" : ""}</p>
          <p className="muted" id="navigation-help">
            Arrastre izquierdo: rotar. Rueda: zoom. Botón derecho, central o Shift + arrastre: panear.
            Teclado en el visor: flechas para rotar, Shift + flechas para panear, +/− para zoom y F para encuadrar.
          </p>
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
