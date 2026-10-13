// Browser preview owns one map instance; location and routes update in place.
import React, { memo, useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
import type { Point } from "../lib/geo";
type Props = { point: Point; target?: Point; route?: number[][]; others?: number[][][]; dark?: boolean };
function SpotMap(props: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const targetRef = useRef<maplibregl.Marker | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const syncRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!ref.current) return;
    const initial = latest.current;
    const map = new maplibregl.Map({ container: ref.current,
      style: `https://tiles.openfreemap.org/styles/${initial.dark ? "dark" : "liberty"}`,
      center: [initial.point.lng, initial.point.lat], zoom: 16,
      attributionControl: { compact: true } });
    mapRef.current = map;
    markerRef.current = new maplibregl.Marker({ color: "#438CDC" })
      .setLngLat([initial.point.lng, initial.point.lat]).addTo(map);
    if (initial.target) map.fitBounds([
      [Math.min(initial.point.lng, initial.target.lng), Math.min(initial.point.lat, initial.target.lat)],
      [Math.max(initial.point.lng, initial.target.lng), Math.max(initial.point.lat, initial.target.lat)],
    ], { padding: 60, maxZoom: 17, duration: 0 });
    function sync() {
      const { point, target, route, others, dark } = latest.current;
      markerRef.current?.setLngLat([point.lng, point.lat]);
      if (target) {
        targetRef.current ??= new maplibregl.Marker({ color: "#14856B" }).setLngLat([target.lng, target.lat]).addTo(map);
        targetRef.current.setLngLat([target.lng, target.lat]);
      } else { targetRef.current?.remove(); targetRef.current = null; }
      if (!map.isStyleLoaded()) return;
      const lines = (coordinates: number[][][]): GeoJSON.FeatureCollection => ({
        type: "FeatureCollection", features: coordinates.filter((c) => c.length > 1).map((c) => ({
          type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: c },
        })),
      });
      const update = (id: string, data: GeoJSON.FeatureCollection, color: string, width: number) => {
        const source = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
        if (source) source.setData(data);
        else {
          map.addSource(id, { type: "geojson", data });
          map.addLayer({ id, type: "line", source: id, paint: { "line-color": color, "line-width": width } });
        }
      };
      update("route-others", lines(others ?? []), dark ? "#7C8F84" : "#8A9A90", 4);
      update("route", lines(route ? [route] : []), "#14856B", 5);
    }
    syncRef.current = sync;
    map.on("style.load", sync);
    sync();
    return () => {
      syncRef.current = () => {};
      markerRef.current?.remove(); targetRef.current?.remove();
      markerRef.current = null; targetRef.current = null;
      map.remove(); mapRef.current = null;
    };
  }, []);
  useEffect(() => { syncRef.current(); }, [props.point.lat, props.point.lng, props.target?.lat, props.target?.lng, props.route, props.others]);
  const theme = useRef(props.dark);
  useEffect(() => {
    if (theme.current === props.dark) return;
    theme.current = props.dark;
    mapRef.current?.setStyle(`https://tiles.openfreemap.org/styles/${props.dark ? "dark" : "liberty"}`);
  }, [props.dark]);
  return <div ref={ref} style={{ width: "100%", height: "100%", flex: 1 }} />;
}
export default memo(SpotMap);
