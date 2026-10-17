import Feature from "ol/Feature.js";
import Graticule from "ol/layer/Graticule.js";
import TileLayer from "ol/layer/Tile.js";
import VectorLayer from "ol/layer/Vector.js";
import Map from "ol/Map.js";
import View from "ol/View.js";
import { defaults as defaultControls, ScaleLine } from "ol/control.js";
import { fromLonLat, toLonLat } from "ol/proj.js";
import OSM from "ol/source/OSM.js";
import VectorSource from "ol/source/Vector.js";
import { Circle as CircleStyle, Fill, Stroke, Style } from "ol/style.js";
import Point from "ol/geom/Point.js";
import Polygon from "ol/geom/Polygon.js";
import proj4 from "proj4";
import type { GisRegistration, LocalPlanExtent } from "@ifc-viewer/domain";
import "ol/ol.css";

export const openLayersAdapter = { name: "openlayers" } as const;

export type GisCursorPosition = { longitude: number; latitude: number };

const registrationProjection = (registration: GisRegistration): string =>
  `+proj=aeqd +lat_0=${registration.latitude} +lon_0=${registration.longitude} +datum=WGS84 +units=m +no_defs +type=crs`;

export class OpenLayersGisAdapter {
  private readonly source = new VectorSource<Feature<Polygon | Point>>();
  private readonly map: Map;
  private registration?: GisRegistration;
  private footprint?: LocalPlanExtent;
  private ifcVisible = true;
  private osmLayer?: TileLayer;
  private readonly onRegistration: (registration: GisRegistration) => void;
  private readonly onCursorPosition: (position?: GisCursorPosition) => void;

  constructor(
    target: HTMLElement,
    onRegistration: (registration: GisRegistration) => void,
    onCursorPosition: (position?: GisCursorPosition) => void,
  ) {
    this.onRegistration = onRegistration;
    this.onCursorPosition = onCursorPosition;
    const modelLayer = new VectorLayer({
      source: this.source,
      style: (feature) => feature.get("role") === "origin"
        ? new Style({
            image: new CircleStyle({
              radius: 7,
              fill: new Fill({ color: "#37c8ff" }),
              stroke: new Stroke({ color: "#07131c", width: 2 }),
            }),
          })
        : new Style({
            stroke: new Stroke({ color: "#37c8ff", width: 2 }),
            fill: new Fill({ color: "#37c8ff33" }),
          }),
    });
    this.map = new Map({
      target,
      controls: defaultControls({ attributionOptions: { collapsible: false } }).extend([
        new ScaleLine({ units: "metric" }),
      ]),
      layers: [new Graticule({ showLabels: true, wrapX: false }), modelLayer],
      view: new View({ center: fromLonLat([-3.7038, 40.4168]), zoom: 5 }),
    });
    this.map.on("singleclick", (event) => {
      const [longitude, latitude] = toLonLat(event.coordinate);
      const localOriginYUpMetres = this.footprint?.origin ?? { x: 0, y: 0, z: 0 };
      this.setRegistration({
        method: "manual-local-center",
        crs: "EPSG:4326",
        longitude,
        latitude,
        localOriginYUpMetres,
        horizontalAxes: { easting: "x", northing: "-z" },
      });
      if (!this.footprint) {
        this.map.getView().animate({ center: event.coordinate, duration: 180 });
      }
    });
    this.map.on("pointermove", (event) => {
      if (event.dragging) return;
      const [longitude, latitude] = toLonLat(event.coordinate);
      this.onCursorPosition({ longitude, latitude });
    });
    this.map.getViewport()?.addEventListener("pointerleave", () => this.onCursorPosition());
  }

  setRegistration(registration: GisRegistration): void {
    this.registration = registration;
    this.onRegistration(registration);
    this.refreshOverlay();
  }

  setFootprint(footprint?: LocalPlanExtent): void {
    this.footprint = footprint;
    if (this.registration && footprint &&
      (this.registration.localOriginYUpMetres.x !== footprint.origin.x ||
       this.registration.localOriginYUpMetres.y !== footprint.origin.y ||
       this.registration.localOriginYUpMetres.z !== footprint.origin.z)) {
      this.registration = {
        ...this.registration,
        localOriginYUpMetres: footprint.origin,
      };
      this.onRegistration(this.registration);
    }
    this.refreshOverlay();
  }

  setIfcVisible(visible: boolean): void {
    this.ifcVisible = visible;
    this.refreshOverlay();
  }

  setVisible(visible: boolean): void {
    if (visible) this.map.updateSize();
    else this.onCursorPosition();
  }

  setBaseMapEnabled(enabled: boolean): void {
    if (enabled && !this.osmLayer) {
      this.osmLayer = new TileLayer({ source: new OSM(), zIndex: 0 });
      this.map.addLayer(this.osmLayer);
    }
    this.osmLayer?.setVisible(enabled);
  }

  fitModel(): void {
    const extent = this.source.getExtent();
    if (!extent || extent.some((value) => !Number.isFinite(value))) return;
    this.map.getView().fit(extent, {
      size: this.map.getSize(),
      padding: [48, 48, 48, 48],
      maxZoom: 20,
      duration: 250,
    });
  }

  dispose(): void {
    this.map.setTarget(undefined);
  }

  private refreshOverlay(): void {
    this.source.clear(true);
    if (!this.registration) return;

    const registration = this.registration;
    const projection = registrationProjection(registration);
    const projectLocalOffset = (x: number, northing: number): number[] => {
      const [longitude, latitude] = proj4(projection, "EPSG:4326", [x, northing]);
      return fromLonLat([longitude, latitude]);
    };
    const center = fromLonLat([registration.longitude, registration.latitude]);

    if (this.footprint && this.ifcVisible) {
      const { minX, maxX, minZ, maxZ } = this.footprint;
      const originNorth = -registration.localOriginYUpMetres.z;
      const northMin = -maxZ - originNorth;
      const northMax = -minZ - originNorth;
      const corners = [
        projectLocalOffset(minX - registration.localOriginYUpMetres.x, northMin),
        projectLocalOffset(maxX - registration.localOriginYUpMetres.x, northMin),
        projectLocalOffset(maxX - registration.localOriginYUpMetres.x, northMax),
        projectLocalOffset(minX - registration.localOriginYUpMetres.x, northMax),
      ];
      corners.push(corners[0]!);
      const footprint = new Feature({ geometry: new Polygon([corners]) });
      footprint.set("role", "footprint");
      this.source.addFeature(footprint);
      const origin = new Feature({ geometry: new Point(center) });
      origin.set("role", "origin");
      this.source.addFeature(origin);
    } else if (this.ifcVisible) {
      const origin = new Feature({ geometry: new Point(center) });
      origin.set("role", "origin");
      this.source.addFeature(origin);
    }
  }
}
