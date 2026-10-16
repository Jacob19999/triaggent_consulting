"use client";

// Leaflet map with an Esri basemap, modelled on the Burn Equity Index dashboard: polygons
// colored on a heat ramp over dark tiles, place labels drawn above the colors, overlays for
// outlines, dashed highlights and hatched flags, and markers for sites. Only county and
// tract aggregates are drawn; shelves appear as county counts, never as locations (D-021).

import type { FeatureCollection, Geometry } from "geojson";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { GeoJSONGeometry } from "@/lib/types";
import { useTheme } from "../theme";

export type Basemap = "auto" | "dark" | "light" | "streets" | "satellite" | "none";

export interface MapMarker {
  id: string;
  lon: number;
  lat: number;
  kind: "site" | "candidate" | "count";
  label?: string;
  active?: boolean;
  size?: number;
  ringsMiles?: number[];
  title?: string;
  onClick?: () => void;
}

export interface LeafletMapProps {
  geometry: Record<string, GeoJSONGeometry>;
  /** Fill for a unit; null draws it as "no data". */
  fill: (id: string) => string | null;
  fillOpacity?: number;
  /** Units drawn faintly (e.g. counties outside an allocation pool). */
  dim?: (id: string) => boolean;
  selected?: string | null;
  onSelect?: (id: string) => void;
  hoverCard?: (id: string) => ReactNode;
  /** Thin outlines drawn above the fills (county lines over tracts). */
  outlines?: Record<string, GeoJSONGeometry>;
  /** Dashed outlines (e.g. Q6 audit-first counties). */
  dashed?: Record<string, GeoJSONGeometry>;
  /** Hatched overlay (e.g. USDA LILA tracts). */
  hatch?: Record<string, GeoJSONGeometry>;
  /** A solid outline around one area (e.g. the county being reviewed in tract view). */
  ring?: GeoJSONGeometry | null;
  markers?: MapMarker[];
  onMapClick?: (lon: number, lat: number) => void;
  /** Geometry to zoom to; null returns to the statewide view. */
  focus?: GeoJSONGeometry | null;
  basemap?: Basemap;
  showLabels?: boolean;
  className?: string;
  ariaLabel?: string;
  /** Pixels to keep the right-hand map controls clear of a floating side panel. */
  controlsInsetRight?: number;
  /** Space taken by floating panels, [top, right, bottom, left] px, kept clear when fitting. */
  fitPadding?: [number, number, number, number];
  children?: ReactNode;
}

// Esri basemaps (no key needed; attribution required). CARTO's free tiles now need an API key.
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
const TILE: Record<Exclude<Basemap, "none" | "auto">, { base: string; labels?: string; attribution: string; maxNativeZoom: number }> = {
  dark: {
    base: "Canvas/World_Dark_Gray_Base",
    labels: "Canvas/World_Dark_Gray_Reference",
    attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community",
    maxNativeZoom: 16,
  },
  light: {
    base: "Canvas/World_Light_Gray_Base",
    labels: "Canvas/World_Light_Gray_Reference",
    attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community",
    maxNativeZoom: 16,
  },
  streets: {
    base: "World_Street_Map",
    attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, USGS, NGA, EPA, USDA, NPS",
    maxNativeZoom: 19,
  },
  satellite: {
    base: "World_Imagery",
    labels: "Reference/World_Boundaries_and_Places",
    attribution: "Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics, and the GIS user community",
    maxNativeZoom: 19,
  },
};
const tileUrl = (name: string) => `${ESRI}/${name}/MapServer/tile/{z}/{y}/{x}`;

function toCollection(geoms: Record<string, GeoJSONGeometry>): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: Object.entries(geoms).map(([id, geometry]) => ({
      type: "Feature",
      id,
      properties: { id },
      geometry: geometry as Geometry,
    })),
  };
}

function boundsOf(geoms: GeoJSONGeometry[]): L.LatLngBounds | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const g of geoms) {
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const poly of polys)
      for (const [lon, lat] of poly[0] ?? []) {
        if (lon < minX) minX = lon;
        if (lon > maxX) maxX = lon;
        if (lat < minY) minY = lat;
        if (lat > maxY) maxY = lat;
      }
  }
  return Number.isFinite(minX) ? L.latLngBounds([minY, minX], [maxY, maxX]) : null;
}

function markerIcon(m: MapMarker): L.DivIcon {
  if (m.kind === "site")
    return L.divIcon({
      className: "fb-pin",
      html: `<div style="position:relative;width:30px;height:30px"><span class="fb-pulse" style="inset:6px 6px 0 6px;top:18px;height:14px;width:18px"></span><div class="fb-pin-site"><span>${m.label ?? "+"}</span></div></div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 36],
    });
  if (m.kind === "candidate")
    return L.divIcon({
      className: "fb-pin",
      html: `<div class="fb-pin-candidate${m.active ? " is-active" : ""}">${m.label ?? ""}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
  const s = m.size ?? 22;
  return L.divIcon({
    className: "fb-pin",
    html: `<div class="fb-pin-count" style="width:${s}px;height:${s}px">${m.label ?? ""}</div>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
  });
}

export function LeafletMap({
  geometry,
  fill,
  fillOpacity = 0.78,
  dim,
  selected,
  onSelect,
  hoverCard,
  outlines,
  dashed,
  hatch,
  ring,
  markers = [],
  onMapClick,
  focus,
  basemap = "auto",
  showLabels = true,
  className,
  ariaLabel,
  controlsInsetRight = 0,
  fitPadding = [16, 16, 16, 16],
  children,
}: LeafletMapProps) {
  const theme = useTheme();
  const resolvedBasemap = basemap === "auto" ? (theme === "dark" ? "dark" : "light") : basemap;
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const home = useRef<L.LatLngBounds | null>(null);
  const fitted = useRef(false);
  // Until the user pans or zooms, layout changes (rail collapse, side drawers) refit the view.
  const autoFit = useRef(true);
  const units = useRef<L.GeoJSON | null>(null);
  const byId = useRef(new Map<string, L.Path>());
  const tiles = useRef<L.TileLayer[]>([]);
  const overlay = useRef<{ outlines?: L.GeoJSON; dashed?: L.GeoJSON; hatch?: L.GeoJSON; ring?: L.GeoJSON }>({});
  const markerLayer = useRef<L.LayerGroup | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [width, setWidth] = useState(800);

  // Latest props for Leaflet callbacks (created once).
  const live = useRef({ fill, fillOpacity, dim, selected, onSelect, onMapClick, theme });
  live.current = { fill, fillOpacity, dim, selected, onSelect, onMapClick, theme };

  const baseStyle = (id: string): L.PathOptions => {
    const p = live.current;
    const c = p.fill(id);
    const dark = p.theme === "dark";
    const faint = p.dim?.(id) ?? false;
    const isSel = p.selected === id;
    return {
      fillColor: c ?? (dark ? "#2a3642" : "#cfd6de"),
      fillOpacity: c == null ? (dark ? 0.35 : 0.5) : faint ? 0.14 : p.fillOpacity,
      color: isSel ? (dark ? "#ffffff" : "#0f1b2a") : dark ? "rgba(11,18,25,0.85)" : "rgba(255,255,255,0.9)",
      weight: isSel ? 3 : 0.6,
      opacity: 1,
    };
  };

  const focusRef = useRef(focus ?? null);
  focusRef.current = focus ?? null;
  const pad = useRef(fitPadding);
  pad.current = fitPadding;
  const fitOpts = (extra: L.FitBoundsOptions = {}): L.FitBoundsOptions => {
    const [t, r, b, l] = pad.current;
    const box = el.current;
    // Never let padding swallow the map on a small screen.
    const w = box?.clientWidth ?? 800;
    const h = box?.clientHeight ?? 600;
    const sx = l + r > w * 0.7 ? (w * 0.7) / (l + r) : 1;
    const sy = t + b > h * 0.7 ? (h * 0.7) / (t + b) : 1;
    return { paddingTopLeft: [l * sx, t * sy], paddingBottomRight: [r * sx, b * sy], ...extra };
  };

  /** Fit Minnesota once the container has a real size (it can mount at zero width). Leaflet caches
   * its size, so the cache is refreshed first. */
  const fitHome = () => {
    const m = map.current;
    const box = el.current;
    if (!m || !box || fitted.current || !home.current) return;
    if (box.clientWidth < 40 || box.clientHeight < 40) return;
    if (!(m as unknown as { _loaded?: boolean })._loaded) m.setView(home.current.getCenter(), 6);
    m.invalidateSize({ pan: false });
    const f = focusRef.current ? boundsOf([focusRef.current]) : null;
    if (f) m.fitBounds(f, fitOpts({ maxZoom: 10, animate: false }));
    else m.fitBounds(home.current, fitOpts({ animate: false }));
    fitted.current = true;
  };

  // Create the map once.
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, {
      zoomControl: false,
      attributionControl: true,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      minZoom: 5,
      maxZoom: 14,
      worldCopyJump: false,
    });
    m.attributionControl.setPrefix(false);
    L.control.zoom({ position: "topright" }).addTo(m);
    const Reset = L.Control.extend({
      onAdd: () => {
        const b = L.DomUtil.create("div", "leaflet-bar leaflet-control fb-reset");
        b.innerHTML =
          '<a href="#" role="button" title="Reset view" aria-label="Reset view to Minnesota"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:-2px"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8m0-5v5h5"/></svg></a>';
        L.DomEvent.disableClickPropagation(b);
        L.DomEvent.on(b, "click", (e) => {
          L.DomEvent.preventDefault(e);
          if (home.current) m.flyToBounds(home.current, fitOpts({ duration: 0.6 }));
        });
        return b;
      },
    });
    new Reset({ position: "topright" }).addTo(m);
    m.createPane("labels");
    const labels = m.getPane("labels")!;
    labels.style.zIndex = "450";
    labels.style.pointerEvents = "none";
    m.on("click", (e: L.LeafletMouseEvent) => live.current.onMapClick?.(e.latlng.lng, e.latlng.lat));
    const ro = new ResizeObserver(() => {
      if (!el.current) return;
      setWidth(el.current.clientWidth);
      if (fitted.current && autoFit.current) fitted.current = false;
      fitHome();
      m.invalidateSize();
    });
    const stopAuto = () => {
      autoFit.current = false;
    };
    el.current.addEventListener("mousedown", stopAuto);
    el.current.addEventListener("wheel", stopAuto, { passive: true });
    el.current.addEventListener("touchstart", stopAuto, { passive: true });
    ro.observe(el.current);
    map.current = m;
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      // React may re-run this effect (strict mode); the next map starts unfitted.
      autoFit.current = true;
      home.current = null;
      fitted.current = false;
      units.current = null;
      overlay.current = {};
      markerLayer.current = null;
      tiles.current = [];
    };
  }, []);

  // Basemap tiles follow the chosen style.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    tiles.current.forEach((t) => t.remove());
    tiles.current = [];
    if (resolvedBasemap === "none") return;
    const t = TILE[resolvedBasemap];
    tiles.current.push(L.tileLayer(tileUrl(t.base), { attribution: t.attribution, maxNativeZoom: t.maxNativeZoom, maxZoom: 19 }).addTo(m));
    if (showLabels && t.labels)
      tiles.current.push(L.tileLayer(tileUrl(t.labels), { pane: "labels", maxNativeZoom: t.maxNativeZoom, maxZoom: 19 }).addTo(m));
  }, [resolvedBasemap, showLabels]);

  // Units (counties or tracts). Rebuilt only when the geometry set changes.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    units.current?.remove();
    byId.current.clear();
    const layer = L.geoJSON(toCollection(geometry), {
      style: (f) => baseStyle(String(f?.properties?.id)),
      onEachFeature: (f, l) => {
        const id = String(f.properties.id);
        const path = l as L.Path;
        byId.current.set(id, path);
        path.on({
          mouseover: (e: L.LeafletMouseEvent) => {
            path.setStyle({ weight: 2.2, color: live.current.theme === "dark" ? "#ffffff" : "#0f1b2a" });
            path.bringToFront();
            setHover({ id, x: e.containerPoint.x, y: e.containerPoint.y });
          },
          mousemove: (e: L.LeafletMouseEvent) => setHover({ id, x: e.containerPoint.x, y: e.containerPoint.y }),
          mouseout: () => {
            path.setStyle(baseStyle(id));
            setHover((h) => (h?.id === id ? null : h));
            const sel = live.current.selected;
            if (sel) byId.current.get(sel)?.bringToFront();
          },
          click: () => {
            if (!live.current.onMapClick) live.current.onSelect?.(id);
          },
        });
      },
    }).addTo(m);
    units.current = layer;
    const b = boundsOf(Object.values(outlines ?? geometry));
    if (b && !home.current) {
      home.current = b;
      m.setView(b.getCenter(), 6);
      fitHome();
    }
    // Overlays sit above the units; re-add them so the order holds.
    (["hatch", "outlines", "dashed", "ring"] as const).forEach((k) => overlay.current[k]?.bringToFront());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry]);

  // Restyle on data, selection or theme changes.
  useEffect(() => {
    byId.current.forEach((path, id) => path.setStyle(baseStyle(id)));
    if (selected) byId.current.get(selected)?.bringToFront();
    (["hatch", "outlines", "dashed", "ring"] as const).forEach((k) => overlay.current[k]?.bringToFront());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fill, fillOpacity, dim, selected, theme]);

  // Overlays.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const dark = theme === "dark";
    const set = (key: "outlines" | "dashed" | "hatch" | "ring", geoms: Record<string, GeoJSONGeometry> | undefined, style: L.PathOptions) => {
      overlay.current[key]?.remove();
      overlay.current[key] =
        geoms && Object.keys(geoms).length
          ? L.geoJSON(toCollection(geoms), { ...style, style: () => style, interactive: false } as L.GeoJSONOptions).addTo(m)
          : undefined;
    };
    set("hatch", hatch, { className: "fb-hatch", stroke: true, color: dark ? "#e8edf2" : "#0f1b2a", weight: 0.7, opacity: 0.7, fill: true });
    set("outlines", outlines, { fill: false, color: dark ? "rgba(232,237,242,0.55)" : "rgba(15,27,42,0.5)", weight: 1 });
    set("dashed", dashed, { fill: false, color: dark ? "#ffffff" : "#0f1b2a", weight: 1.8, dashArray: "5 4", opacity: 0.95 });
    set("ring", ring ? { ring } : undefined, { fill: false, color: dark ? "#ffffff" : "#0f1b2a", weight: 3, opacity: 1 });
    if (selected) byId.current.get(selected)?.bringToFront();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlines, dashed, hatch, ring, theme]);

  // Markers and catchment rings.
  const markerKey = JSON.stringify(markers.map((mk) => [mk.id, mk.lon, mk.lat, mk.kind, mk.label, mk.active, mk.size, mk.ringsMiles]));
  const markerRef = useRef(markers);
  markerRef.current = markers;
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markerLayer.current?.remove();
    const g = L.layerGroup();
    const dark = theme === "dark";
    for (const mk of markerRef.current) {
      (mk.ringsMiles ?? []).forEach((miles, i) =>
        L.circle([mk.lat, mk.lon], {
          radius: miles * 1609.34,
          color: dark ? "#ffffff" : "#0f1b2a",
          weight: 1.4,
          dashArray: "6 5",
          opacity: 0.85,
          fill: i === 0,
          fillColor: dark ? "#3ccf9f" : "#0b7a63",
          fillOpacity: 0.08,
          interactive: false,
        }).addTo(g),
      );
      const marker = L.marker([mk.lat, mk.lon], {
        icon: markerIcon(mk),
        title: mk.title,
        keyboard: !!mk.onClick,
        interactive: !!mk.onClick || !!mk.title,
        zIndexOffset: mk.kind === "site" ? 1000 : mk.active ? 900 : 0,
      });
      if (mk.onClick)
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          markerRef.current.find((x) => x.id === mk.id)?.onClick?.();
        });
      marker.addTo(g);
    }
    g.addTo(m);
    markerLayer.current = g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markerKey, theme]);

  // Zoom to a focus geometry, or back to the statewide view.
  const focusKey = useMemo(() => (focus ? JSON.stringify(boundsOf([focus])?.toBBoxString()) : null), [focus]);
  useEffect(() => {
    const m = map.current;
    // The first fit picks up the focus; Leaflet cannot animate before it has a view.
    if (!m || !fitted.current || !(m as unknown as { _loaded?: boolean })._loaded) return;
    if (focus) {
      const b = boundsOf([focus]);
      if (b) m.flyToBounds(b, fitOpts({ duration: 0.6, maxZoom: 10 }));
    } else if (home.current) {
      m.flyToBounds(home.current, fitOpts({ duration: 0.6 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  useEffect(() => {
    el.current?.classList.toggle("fb-placing", !!onMapClick);
  }, [onMapClick]);

  useEffect(() => {
    el.current?.classList.toggle("fb-tiles-dark", resolvedBasemap === "dark");
  }, [resolvedBasemap]);

  useEffect(() => {
    el.current?.querySelectorAll<HTMLElement>(".leaflet-right").forEach((n) => {
      n.style.right = `${controlsInsetRight}px`;
      n.style.transition = "right 0.2s";
    });
  }, [controlsInsetRight]);

  const card = hover && hoverCard ? hoverCard(hover.id) : null;

  return (
    <div className={`relative isolate h-full w-full overflow-hidden ${className ?? ""}`}>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <defs>
          <pattern id="fb-hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="7" stroke={theme === "dark" ? "#ffffff" : "#0f1b2a"} strokeWidth="1.6" opacity="0.6" />
          </pattern>
        </defs>
      </svg>
      <div ref={el} className="fb-map absolute inset-0 z-0" role="region" aria-label={ariaLabel ?? "Minnesota map"} />
      {card && hover && (
        <div
          className="fb-fade-in pointer-events-none absolute z-[700] max-w-[280px] rounded-lg border border-line bg-surface/95 px-3 py-2.5 text-[12.5px] shadow-[var(--shadow-lg)] backdrop-blur"
          style={{
            left: hover.x,
            top: hover.y,
            transform: `translate(${hover.x > width - 300 ? "calc(-100% - 14px)" : "14px"}, -50%)`,
          }}
        >
          {card}
        </div>
      )}
      {children}
    </div>
  );
}

export default LeafletMap;
