import type { Point } from "./geo";

export type RouteKind = "walk" | "road";
export type RouteOption = {
  id: string;
  kind: RouteKind;
  label: string;
  coords: number[][];
  distance: number;
};

const BASE = "https://routing.openstreetmap.de";
export const MAX_FOOT_ROUTES = 3;
// A road route longer than this multiple of the best walking route is not offered.
const ROAD_DETOUR_LIMIT = 1.5;

// The profile segment in the path is ignored by FOSSGIS; the server name picks the profile.
export function routeUrl(kind: RouteKind, from: Point, to: Point) {
  const server = kind === "walk" ? "routed-foot" : "routed-car";
  const alt = kind === "walk" ? `&alternatives=${MAX_FOOT_ROUTES}` : "";
  return `${BASE}/${server}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson${alt}`;
}

function validCoords(c: unknown): c is number[][] {
  return (
    Array.isArray(c) &&
    c.length > 1 &&
    c.every(
      (v) =>
        Array.isArray(v) &&
        v.length >= 2 &&
        Number.isFinite(v[0]) &&
        Number.isFinite(v[1]) &&
        Math.abs(v[0]) <= 180 &&
        Math.abs(v[1]) <= 90,
    )
  );
}

type Raw = { distance?: unknown; geometry?: { coordinates?: unknown } };

// Returns only well-formed routes, in server order (the server's best route first).
export function parseRoutes(data: unknown, kind: RouteKind): RouteOption[] {
  const raw = (data as { code?: string; routes?: Raw[] } | null)?.routes;
  if (!Array.isArray(raw)) return [];
  const out: RouteOption[] = [];
  for (const r of raw.slice(0, kind === "walk" ? MAX_FOOT_ROUTES : 1)) {
    const coords = r?.geometry?.coordinates;
    if (!validCoords(coords) || !Number.isFinite(r.distance)) continue;
    out.push({
      id: `${kind}-${out.length}`,
      kind,
      label: "",
      coords,
      distance: r.distance as number,
    });
  }
  return out;
}

// Share of the shorter route's points that lie within ~25 m of the other route:
// used to drop alternatives that are effectively the same line.
function overlap(a: number[][], b: number[][]) {
  const s = a.length <= b.length ? a : b;
  const other = s === a ? b : a;
  const hit = s.filter((p) =>
    other.some(
      (q) => Math.abs(p[0] - q[0]) < 0.0003 && Math.abs(p[1] - q[1]) < 0.0003,
    ),
  ).length;
  return hit / s.length;
}

// Combine walking alternatives with an optional main-road route. The first walking
// route is the recommended one. The road route is never recommended automatically.
export function buildOptions(
  walk: RouteOption[],
  road: RouteOption | undefined,
): RouteOption[] {
  const picked: RouteOption[] = [];
  for (const r of walk) {
    if (picked.every((p) => overlap(p.coords, r.coords) < 0.9)) picked.push(r);
  }
  if (
    road &&
    picked.length > 0 &&
    road.distance <= picked[0].distance * ROAD_DETOUR_LIMIT &&
    picked.every((p) => overlap(p.coords, road.coords) < 0.9)
  )
    picked.push(road);
  let n = 0;
  return picked.map((r, i) => {
    if (r.kind === "road") return { ...r, id: "road", label: "Main road" };
    n += 1;
    return {
      ...r,
      id: `walk-${i}`,
      label: n === 1 ? "Best" : `Option ${n}`,
    };
  });
}
