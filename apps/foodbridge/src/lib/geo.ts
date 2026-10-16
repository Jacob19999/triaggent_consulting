import type { GeoJSONGeometry } from "./types";

const EARTH_MILES = 3958.8;

export function haversineMiles(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Equirectangular projection with a Minnesota standard parallel. Planar, so polygon
 * winding never matters and click positions invert exactly. */
const K = Math.cos((46.3 * Math.PI) / 180);

export interface Projection {
  project(lon: number, lat: number): [number, number];
  invert(x: number, y: number): [number, number];
  milesToPx(miles: number): number;
}

export function fitProjection(
  geometries: GeoJSONGeometry[],
  width: number,
  height: number,
  pad = 8,
): Projection {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const g of geometries) {
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const poly of polys)
      for (const ring of poly)
        for (const [lon, lat] of ring) {
          const x = lon * K;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (lat < minY) minY = lat;
          if (lat > maxY) maxY = lat;
        }
  }
  const scale = Math.min((width - 2 * pad) / (maxX - minX), (height - 2 * pad) / (maxY - minY));
  const offX = (width - (maxX - minX) * scale) / 2;
  const offY = (height - (maxY - minY) * scale) / 2;
  return {
    project: (lon, lat) => [offX + (lon * K - minX) * scale, offY + (maxY - lat) * scale],
    invert: (x, y) => [((x - offX) / scale + minX) / K, maxY - (y - offY) / scale],
    milesToPx: (miles) => (miles / 69.05) * scale,
  };
}

export function pathFor(g: GeoJSONGeometry, p: Projection): string {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  let d = "";
  for (const poly of polys)
    for (const ring of poly) {
      ring.forEach(([lon, lat], i) => {
        const [x, y] = p.project(lon, lat);
        d += `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
      });
      d += "Z";
    }
  return d;
}

/** Ray-casting point-in-polygon on lon/lat (outer rings and holes). */
export function containsPoint(g: GeoJSONGeometry, lon: number, lat: number): boolean {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  let inside = false;
  for (const poly of polys)
    for (const ring of poly) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
  return inside;
}
