// Browser preview uses the same map data. Android uses the native MapLibre renderer.
import React, { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
import type { Point } from "../lib/geo";
type Props = {
  point: Point;
  target?: Point;
  route?: number[][];
  others?: number[][][];
  dark?: boolean;
};
export default function SpotMap({ point, target, route, others, dark }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: `https://tiles.openfreemap.org/styles/${dark ? "dark" : "liberty"}`,
      center: [point.lng, point.lat],
      zoom: 16,
      attributionControl: { compact: true },
    });
    if (target)
      map.fitBounds(
        [
          [Math.min(point.lng, target.lng), Math.min(point.lat, target.lat)],
          [Math.max(point.lng, target.lng), Math.max(point.lat, target.lat)],
        ],
        { padding: 60, maxZoom: 17, duration: 0 },
      );
    new maplibregl.Marker({ color: "#438CDC" })
      .setLngLat([point.lng, point.lat])
      .addTo(map);
    if (target)
      new maplibregl.Marker({ color: "#14856B" })
        .setLngLat([target.lng, target.lat])
        .addTo(map);
    map.on("load", () => {
      if (others && others.length > 0) {
        map.addSource("route-others", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: others.map((coordinates) => ({
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates },
            })),
          },
        });
        map.addLayer({
          id: "route-others",
          type: "line",
          source: "route-others",
          paint: {
            "line-color": dark ? "#7C8F84" : "#8A9A90",
            "line-width": 4,
            "line-opacity": 0.7,
          },
        });
      }
      if (route && route.length > 1) {
        map.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: route },
          },
        });
        map.addLayer({
          id: "route",
          type: "line",
          source: "route",
          paint: { "line-color": "#14856B", "line-width": 5 },
        });
      }
    });
    return () => map.remove();
  }, [point.lat, point.lng, target?.lat, target?.lng, route, others, dark]);
  return <div ref={ref} style={{ width: "100%", height: "100%", flex: 1 }} />;
}
