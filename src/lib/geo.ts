export type Point = {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: number;
};
export type Spot = Point & {
  id: string;
  name: string;
  note: string;
  createdAt: number;
};
export function distance(a: Point, b: Point) {
  const rad = (v: number) => (v * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) *
      Math.cos(rad(b.lat)) *
      Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export const distanceLabel = (m: number) =>
  m < 1000 ? `${Math.round(m / 5) * 5} m` : `${(m / 1000).toFixed(1)} km`;
export const walkLabel = (m: number) => Math.max(1, Math.round(m / 83.3));
/** Rough driving time at a 30 km/h urban average; routed-car replaces it when online. */
export const driveLabel = (m: number) => Math.max(1, Math.round(m / 500));
/** Whole minutes from a server route duration in seconds. */
export const durationMinutes = (seconds: number) =>
  Math.max(1, Math.round(seconds / 60));
export const mapsUrl = (p: Point, travel: "walking" | "driving" = "walking") =>
  `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=${travel}`;
export function validSpot(s: unknown): s is Spot {
  if (!s || typeof s !== "object") return false;
  const p = s as Spot;
  return (
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    typeof p.note === "string" &&
    Number.isFinite(p.lat) &&
    Math.abs(p.lat) <= 90 &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lng) <= 180 &&
    Number.isFinite(p.createdAt)
  );
}
export const routeSummary = (m: number) =>
  `${walkLabel(m)} min · ${distanceLabel(m)}`;

